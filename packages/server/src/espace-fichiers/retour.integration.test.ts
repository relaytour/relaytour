import { afterAll, describe, expect, it, vi } from 'vitest'

// Adresse de retour commune (ADR 0051), du début de la connexion à son retour, sur le
// vrai Valkey. Les variables se posent avant le premier import de env.ts : les modules
// du serveur s'importent donc seulement après, et ce fichier tourne isolé des autres.
vi.stubEnv(
  'ESPACE_FICHIERS_RETOUR',
  'https://retour.exemple.org/espace-fichiers'
)
vi.stubEnv('ESPACE_FICHIERS_RETOUR_ETIQUETTE', 'club')
vi.stubEnv('GOOGLE_CLIENT_ID', 'client-essai')
vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret-essai')

const { commencerConnexion, configurationGoogle, reprendreConnexion } =
  await import('./index.ts')

const DONNEES = {
  organisationId: 'organisation-essai-retour',
  userId: 'personne-essai-retour',
  fournisseur: 'GOOGLE_DRIVE' as const,
}

afterAll(async () => {
  const { connection } = await import('../jobs/queues.ts')
  connection.disconnect()
  vi.unstubAllEnvs()
})

describe('adresse de retour commune', () => {
  it('envoie l’adresse commune au fournisseur', async () => {
    expect((await configurationGoogle())?.retour).toBe(
      'https://retour.exemple.org/espace-fichiers/google'
    )
  })

  it('place l’étiquette devant l’état, et reprend cet état une seule fois', async () => {
    const { etat } = await commencerConnexion(DONNEES)
    expect(etat).toMatch(/^club\.[A-Za-z0-9_-]{43}$/)
    expect(await reprendreConnexion(etat)).toMatchObject(DONNEES)
    expect(await reprendreConnexion(etat)).toBeNull()
  })

  it('refuse l’état d’une autre installation ou sans étiquette, sans consommer le sien', async () => {
    const { etat } = await commencerConnexion(DONNEES)
    const alea = etat.slice('club.'.length)
    expect(await reprendreConnexion(alea)).toBeNull()
    expect(await reprendreConnexion(`autre.${alea}`)).toBeNull()
    expect(await reprendreConnexion(`club.${alea}x`)).toBeNull()
    expect(await reprendreConnexion(etat)).toMatchObject(DONNEES)
  })
})
