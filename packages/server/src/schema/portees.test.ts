import type { GraphQLObjectType } from 'graphql'
import { describe, expect, it } from 'vitest'

import { schema } from './index.ts'

// Portées d'autorisation réservées (ADR 0064). Un jeton d'accès n'ouvre jamais les
// champs à portée `session` : la gestion des jetons, les opérations du compte, les
// secrets et les appareils. La gestion des membres demande en plus la dimension
// `gestionMembres` du jeton. Ce test fige les deux listes : un champ qui entre ou
// sort d'une liste change ce que la détentrice d'un jeton peut faire, et se décide
// au moment de la revue, pas par oubli.

type Portees = Record<string, unknown> & { $all?: Record<string, unknown> }

/** Les champs racine dont la portée statique exige `portee`, seule ou dans `$all`. */
function champsAPortee(
  type: GraphQLObjectType | null | undefined,
  portee: string
) {
  if (!type) return []
  return Object.entries(type.getFields())
    .filter(([, champ]) => {
      const options = (
        champ.extensions as { pothosOptions?: { authScopes?: unknown } }
      ).pothosOptions
      const portees = options?.authScopes
      if (typeof portees !== 'object' || portees === null) return false
      const statiques = portees as Portees
      return statiques[portee] === true || statiques.$all?.[portee] === true
    })
    .map(([nom]) => nom)
    .sort()
}

describe('portées réservées à la session', () => {
  it('les lectures qui exigent une session sont celles-ci', () => {
    expect(champsAPortee(schema.getQueryType(), 'session')).toEqual([
      'abonnePush',
      'abonnementAgendaActivite',
      'exportContenu',
      'exportOrganisation',
      'jetonsAccesOrganisation',
      'mesJetonsAcces',
      'monAbonnementAgenda',
      'notificationsAutresOrganisations',
      'robots',
    ])
  })

  it('les mutations qui exigent une session sont celles-ci', () => {
    expect(champsAPortee(schema.getMutationType(), 'session')).toEqual([
      'abonnerPush',
      'activerApi',
      'commencerConnexionEspaceFichiers',
      'commencerConnexionNextcloud',
      'connecterCompteServiceGoogle',
      'creerAbonnementAgendaActivite',
      'creerJetonAcces',
      'creerJetonRobot',
      'creerMonAbonnementAgenda',
      'creerRobot',
      'deconnecterEspaceFichiers',
      'desabonnerPush',
      'desactiverApi',
      'lienEspaceBenevole',
      'modifierMonAdresseVisible',
      'modifierPreferencesNotification',
      'reglerAbonnementAgendaActivite',
      'reglerMonAbonnementAgenda',
      'renvoyerLienBenevole',
      'revoquerAbonnementAgendaActivite',
      'revoquerJetonAcces',
      'revoquerJetonOrganisation',
      'revoquerJetonRobot',
      'revoquerMesJetonsAcces',
      'revoquerMonAbonnementAgenda',
      'saisirAdresseFournisseur',
      'terminerConnexionNextcloud',
    ])
  })
})

describe('portée « gestion des membres »', () => {
  it('les mutations qui ajoutent, retirent ou promeuvent une personne sont celles-ci', () => {
    expect(champsAPortee(schema.getMutationType(), 'gestionMembres')).toEqual([
      'accepterDemande',
      'archiverPersonne',
      'definirAdminActivite',
      'importerEquipe',
      'inviterPersonne',
      'modifierPersonne',
      'relancerInvitation',
      'retirerInvitation',
    ])
  })

  it('aucune lecture ne l’exige', () => {
    expect(champsAPortee(schema.getQueryType(), 'gestionMembres')).toEqual([])
  })
})
