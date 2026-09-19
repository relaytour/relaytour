import http from 'node:http'

import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import cors from 'cors'
import express from 'express'
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node'

import { auth } from './auth.ts'
import { buildContext, type AppContext } from './context.ts'
import { env } from './env.ts'
import { journal } from './lib/journal.ts'
import { assurerOrganisationParDefaut } from './lib/organisation.ts'
import { writeSchemaFile } from './lib/print-schema.ts'
import { sonderDependances } from './lib/sante.ts'
import { schema } from './schema/index.ts'

const app = express()
const httpServer = http.createServer(app)

// Un seul proxy devant l'API (Caddy) : req.ip et X-Forwarded-Proto sont fiables.
app.set('trust proxy', 1)
app.disable('x-powered-by')

const apollo = new ApolloServer<AppContext>({
  schema,
  introspection: env.APP_ENV !== 'prod',
  plugins: [
    ApolloServerPluginDrainHttpServer({
      httpServer,
      stopGracePeriodMillis: env.DRAIN_GRACE_MS,
    }),
  ],
})

// La ligne Organisation existe dès le premier démarrage (ADR 0006, lot commun).
await assurerOrganisationParDefaut()

await apollo.start()

// Vivacité : aucune dépendance sondée, pour qu'un hoquet de la base ne fasse pas
// redémarrer le conteneur en boucle. Les champs de version viennent du build.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: env.APP_ENV,
    uptime: process.uptime(),
    version: process.env.APP_VERSION ?? '0.0.0-local',
    gitSha: process.env.APP_GIT_SHA ?? 'inconnu',
    builtAt: process.env.APP_BUILT_AT ?? 'inconnu',
  })
})

// Disponibilité : la base et Redis répondent-ils ?
app.get('/ready', (_req, res) => {
  void sonderDependances().then(
    sante => {
      const pret = sante.db === 'ok' && sante.redis === 'ok'
      res
        .status(pret ? 200 : 503)
        .json({ status: pret ? 'ready' : 'degraded', ...sante })
    },
    () => {
      res.status(503).json({ status: 'degraded', db: 'down', redis: 'down' })
    }
  )
})

// Better Auth lit lui-même le corps des requêtes : son routeur passe avant express.json().
const gestionnaireAuth = toNodeHandler(auth)
app.all('/api/auth/*', (req, res) => {
  void gestionnaireAuth(req, res)
})

app.use(
  '/graphql',
  cors({ origin: env.CORS_ORIGIN, credentials: true }),
  express.json({ limit: '1mb' }),
  expressMiddleware(apollo, {
    context: async ({ req }) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      })
      return buildContext(req.ip, session?.user.id ?? null)
    },
  })
)

if (env.APP_ENV === 'local') {
  // Le contrat commité est réécrit à chaque démarrage local si le schéma a changé.
  writeSchemaFile(schema, new URL('../schema.graphql', import.meta.url))
}

httpServer.on('error', err => {
  journal.error(
    { evenement: 'demarrage-impossible', message: err.message },
    'Impossible de démarrer le serveur.'
  )
  process.exit(1)
})

// Arrêt propre et borné : les requêtes en cours disposent de DRAIN_GRACE_MS, puis les
// connexions restantes sont fermées. Le processus sort toujours avant le SIGKILL de Docker.
let enCoursDArret = false
const arreter = (signal: string) => {
  if (enCoursDArret) return
  enCoursDArret = true
  journal.info(
    { evenement: 'arret-demande', signal },
    `Signal ${signal} reçu : arrêt en cours.`
  )

  const drainBorne = Promise.race([
    apollo.stop(),
    new Promise<void>(resolve => {
      const t = setTimeout(() => {
        httpServer.closeAllConnections()
        resolve()
      }, env.DRAIN_GRACE_MS)
      t.unref()
    }),
  ])

  const couperCourt = setTimeout(() => {
    journal.error(
      { evenement: 'arret-force' },
      'L’arrêt a dépassé son délai : sortie forcée.'
    )
    process.exit(1)
  }, env.SHUTDOWN_TIMEOUT_MS)
  couperCourt.unref()

  void drainBorne.then(
    () => {
      clearTimeout(couperCourt)
      process.exit(0)
    },
    (err: unknown) => {
      journal.error(
        { evenement: 'arret-echoue', erreur: err },
        'L’arrêt a échoué.'
      )
      process.exit(1)
    }
  )
}
process.on('SIGTERM', () => arreter('SIGTERM'))
process.on('SIGINT', () => arreter('SIGINT'))

httpServer.listen(env.PORT, () => {
  journal.info(
    { evenement: 'serveur-pret', port: env.PORT },
    `API prête sur http://localhost:${env.PORT}/graphql`
  )
})
