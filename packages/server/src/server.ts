import http from 'node:http'

import { ApolloServer } from '@apollo/server'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { expressMiddleware } from '@as-integrations/express5'
import { prisma } from '@relaytour/database'
import cors from 'cors'
import express from 'express'
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node'

import { auth } from './auth.ts'
import {
  buildContext,
  ENTETE_ACTIVITE,
  ENTETE_ORGANISATION,
  type AppContext,
} from './context.ts'
import { env } from './env.ts'
import { creerGestionnaireFlux } from './flux-http.ts'
import { manifestApplication, slugDuManifest } from './lib/application.ts'
import { adresseClient, ENTETE_IP_CLIENT } from './lib/adresse-client.ts'
import { fermerLesFlux } from './lib/flux.ts'
import { jetonValide } from './lib/jeton.ts'
import { journal } from './lib/journal.ts'
import { formaterErreur } from './lib/erreurs.ts'
import { limiterParCle, rendreTentative } from './lib/limite.ts'
import { EXTENSIONS, type TypeMedia } from './lib/medias.ts'
import {
  assurerOrganisationParDefaut,
  configurationOrganisation,
} from './lib/organisation.ts'
import { writeSchemaFile } from './lib/print-schema.ts'
import { requeteLocale } from './lib/requete-locale.ts'
import { sonderDependances } from './lib/sante.ts'
import { schema } from './schema/index.ts'

const app = express()
const httpServer = http.createServer(app)

// Un seul proxy devant l'API (Caddy) : req.ip et X-Forwarded-Proto sont fiables.
app.set('trust proxy', 1)
app.disable('x-powered-by')

const jetonAdministrationValide = (jeton: string) =>
  jetonValide(jeton, env.JETON_ADMINISTRATION)

// En-têtes de sécurité posés par le serveur lui-même, pour une installation dont le
// proxy ne les pose pas. Le Caddyfile d'exemple les pose aussi, avec la politique de
// contenu de l'espace organisateur. L'API ne sert aucun document : sa politique de
// contenu interdit tout, hors du poste local où la page d'Apollo charge des scripts.
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  })
  if (env.APP_ENV === 'prod') {
    res.set(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    )
  }
  if (req.secure) {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})

const apollo = new ApolloServer<AppContext>({
  schema,
  introspection: env.APP_ENV !== 'prod',
  // Une erreur interne (Prisma, exécution) sort masquée, sous une référence journalisée.
  formatError: formaterErreur,
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
// redémarrer le conteneur en boucle. Les champs de version viennent du build et ne
// sortent que pour une requête locale (sonde du conteneur, outils de la machine) :
// une requête relayée par le proxy ne lit ni l'empreinte du commit ni la date du build.
app.get('/health', (req, res) => {
  res.json(
    requeteLocale(req)
      ? {
          status: 'ok',
          env: env.APP_ENV,
          uptime: process.uptime(),
          version: process.env.APP_VERSION ?? '0.0.0-local',
          gitSha: process.env.APP_GIT_SHA ?? 'inconnu',
          builtAt: process.env.APP_BUILT_AT ?? 'inconnu',
        }
      : { status: 'ok' }
  )
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

// Images d'identité (ADR 0009) : publiques, comme le nom et le thème que l'écran
// de connexion affiche. L'adresse porte l'empreinte du fichier : le contenu d'une
// adresse ne change jamais, et le navigateur la garde en cache. La politique de
// sécurité bloque tout script, y compris dans un SVG ouvert directement.
app.get('/medias/:fichier', (req, res) => {
  const m = /^([0-9a-f]{64})\.(png|svg)$/.exec(req.params.fichier)
  if (m === null) {
    res.status(404).end()
    return
  }
  void prisma.media
    .findFirst({
      where: { empreinte: m[1] },
      select: { type: true, donnees: true },
    })
    .then(
      media => {
        if (media === null || EXTENSIONS[media.type as TypeMedia] !== m[2]) {
          res.status(404).end()
          return
        }
        res
          .set({
            'Content-Type': media.type,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy':
              "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            'Cross-Origin-Resource-Policy': 'cross-origin',
          })
          .send(Buffer.from(media.donnees))
      },
      () => {
        res.status(503).end()
      }
    )
})

// Manifest de l'application installée (ADR 0023) : un par organisation, lisible
// sans session. Il ne porte que l'identité publique de l'organisation. Le chemin
// vit sous `/medias/`, déjà relayé par le proxy de l'installation.
app.get('/medias/application/:fichier', (req, res) => {
  const slug = slugDuManifest(req.params.fichier)
  if (slug === null) {
    res.status(404).end()
    return
  }
  void prisma.organisation
    .findFirst({
      where: { slug, statut: { in: ['ACTIVE', 'LECTURE_SEULE'] } },
      select: { id: true },
    })
    .then(organisation =>
      organisation === null ? null : configurationOrganisation(organisation.id)
    )
    .then(
      configuration => {
        if (configuration === null) {
          res.status(404).end()
          return
        }
        res
          .set({
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff',
          })
          .send(JSON.stringify(manifestApplication(configuration)))
      },
      () => {
        res.status(503).end()
      }
    )
})

// Better Auth lit lui-même le corps des requêtes : son routeur passe avant express.json().
const gestionnaireAuth = toNodeHandler(auth)
app.all('/api/auth/*splat', (req, res) => {
  // L'adresse du client, pour les compteurs de Better Auth : celle que le serveur a
  // établie, réécrite dans l'en-tête que Better Auth lit, jamais celle qu'un client annonce.
  req.headers[ENTETE_IP_CLIENT] = adresseClient(req)
  void gestionnaireAuth(req, res)
})

// Dix jetons d'administration refusés en quinze minutes depuis une même adresse, et
// cette adresse n'est plus écoutée pendant la fenêtre : un jeton exact y vaut un jeton faux.
const REFUS_DE_JETON = { max: 10, fenetreSecondes: 15 * 60 }

/**
 * Le contexte d'une requête : le jeton d'administration de l'installation, sinon la
 * session et l'organisation désignée. L'API et le flux des changements le partagent.
 */
async function contexteDeRequete(req: express.Request): Promise<AppContext> {
  // Le jeton d'administration de l'installation ignore toute session (ADR 0008).
  // Un en-tête Bearer, même vide ou malformé, écarte la session : un jeton
  // faux rend la requête anonyme.
  const ip = adresseClient(req)
  const porteur = /^Bearer\b\s*(.*)$/i.exec(req.get('authorization') ?? '')
  if (porteur !== null) {
    // Avec JETON_ADMINISTRATION_LOCAL, un jeton relayé par le proxy ne vaut rien :
    // la requête devient anonyme, comme avec un jeton faux (ADR 0013).
    // La tentative se réserve avant la comparaison, puis se rend si le jeton est
    // exact : seuls les refus s'accumulent, et des requêtes parallèles ne passent pas
    // ensemble au-delà de la limite.
    const cleRefus = `jeton-refuse:${ip}`
    const tentativePermise = await limiterParCle(
      cleRefus,
      REFUS_DE_JETON.max,
      REFUS_DE_JETON.fenetreSecondes
    )
    const valide =
      tentativePermise &&
      jetonAdministrationValide((porteur[1] ?? '').trim()) &&
      (!env.JETON_ADMINISTRATION_LOCAL || requeteLocale(req))
    if (valide) {
      await rendreTentative(cleRefus)
    } else {
      journal.warn(
        { evenement: 'jeton-administration-refuse', ip },
        'Un jeton d’administration invalide a été présenté.'
      )
    }
    return buildContext(ip, null, null, valide)
  }
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })
  // L'espace organisateur désigne l'organisation active par un en-tête ; sans
  // lui, l'unique appartenance de la personne fait foi (ADR 0008).
  return buildContext(
    ip,
    session?.user.id ?? null,
    req.get(ENTETE_ORGANISATION)?.trim() || null,
    false,
    req.get(ENTETE_ACTIVITE)?.trim() || null
  )
}

app.use(
  '/graphql',
  cors({ origin: env.CORS_ORIGIN, credentials: true }),
  express.json({ limit: '1mb' }),
  // Les abonnements partent en SSE (ADR 0017) ; le reste continue vers Apollo.
  creerGestionnaireFlux({ contexte: contexteDeRequete }),
  expressMiddleware(apollo, { context: ({ req }) => contexteDeRequete(req) })
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

  // Les flux se ferment d'abord : une connexion SSE ouverte retiendrait l'arrêt
  // jusqu'à son délai.
  const drainBorne = Promise.race([
    fermerLesFlux().then(() => apollo.stop()),
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
