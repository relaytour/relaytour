import { prisma } from '@relaytour/database'

import { avecDelai } from './delai.ts'

export type EtatDependance = 'ok' | 'down'

export interface Sante {
  db: EtatDependance
  redis: EtatDependance
}

// Sonde partagée par le champ GraphQL `health` et la route HTTP /ready.
// L'import de la connexion Redis est paresseux : queues.ts valide l'environnement au
// chargement, et l'impression du schéma doit fonctionner sans .env.
export async function sonderDependances(): Promise<Sante> {
  const { connection } = await import('../jobs/queues.ts')
  const [db, redis] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(
      (): EtatDependance => 'ok',
      (): EtatDependance => 'down'
    ),
    avecDelai(connection.ping(), 1_000, 'Redis').then(
      (): EtatDependance => 'ok',
      (): EtatDependance => 'down'
    ),
  ])
  return { db, redis }
}
