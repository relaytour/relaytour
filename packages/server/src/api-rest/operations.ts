// Routes de l'API REST v1 (ADR 0064).
//
// Chaque route exécute un document GraphQL écrit ici, sur le schéma de l'API, avec
// le contexte du jeton d'accès. La route n'ouvre donc aucun droit que GraphQL
// n'ouvre pas. Les documents ne sélectionnent que des champs lisibles par toute
// personne qui lit l'objet : un champ réservé à un admin ferait échouer la réponse.
// Le contrat OpenAPI se calcule à partir de ces documents (openapi.ts).

export type MethodeRest = 'GET' | 'POST' | 'PATCH'

export interface OperationRest {
  /** Identifiant OpenAPI de l'opération, en camelCase. */
  nom: string
  methode: MethodeRest
  /** Chemin Express, sous /api/v1 : un paramètre s'écrit `:nom`. */
  chemin: string
  /** Le document GraphQL : une seule opération, un seul champ racine. */
  document: string
  resume: string
  /** Statut HTTP d'une réponse réussie. */
  statut?: 200 | 201
  /** Regroupement dans le contrat OpenAPI. */
  groupe: 'compte' | 'activites' | 'taches' | 'fiches'
}

// Une tâche dans une liste par périmètre : son périmètre et sa période sont ceux de
// la liste, et ses personnes assignées se lisent par la route d'une tâche. La
// sélection reste sous la limite de complexité du serveur (2 000 points).
const TACHE_COURTE = `
  id
  titre
  statut
  echeance
  enRetard
  jalon
  version
  modifieeLe
`

const TACHE = `
  id
  titre
  description
  statut
  echeance
  enRetard
  jalon
  version
  creeLe
  modifieeLe
  termineeLe
  perimetre { id slug nom }
  edition { id annee nom }
  assignes { id nom }
`

export const OPERATIONS_REST: readonly OperationRest[] = [
  {
    nom: 'moi',
    methode: 'GET',
    chemin: '/moi',
    groupe: 'compte',
    resume: 'La personne au nom de qui le jeton agit.',
    document: `query Moi { moi { id nom email } }`,
  },
  {
    nom: 'jetonCourant',
    methode: 'GET',
    chemin: '/jeton',
    groupe: 'compte',
    resume: 'Les bornes du jeton : sa portée, ses activités et sa date de fin.',
    document: `query JetonCourant { jetonCourant { portee gestionMembres activiteIds expireLe } }`,
  },
  {
    nom: 'activites',
    methode: 'GET',
    chemin: '/activites',
    groupe: 'activites',
    resume: 'Les activités que la personne voit, dans la limite du jeton.',
    document: `query Activites {
      activites { id slug nom nature archive modules }
    }`,
  },
  {
    nom: 'editions',
    methode: 'GET',
    chemin: '/activites/:activiteId/editions',
    groupe: 'activites',
    resume: 'Les périodes d’une activité.',
    document: `query Editions($activiteId: ID!) {
      editions(activiteId: $activiteId) { id annee nom debut fin statut }
    }`,
  },
  {
    nom: 'editionCourante',
    methode: 'GET',
    chemin: '/activites/:activiteId/edition-courante',
    groupe: 'activites',
    resume: 'La période en cours d’une activité, ou null.',
    document: `query EditionCourante($activiteId: ID!) {
      editionCourante(activiteId: $activiteId) { id annee nom debut fin statut }
    }`,
  },
  {
    nom: 'perimetres',
    methode: 'GET',
    chemin: '/activites/:activiteId/perimetres',
    groupe: 'activites',
    resume:
      'Les périmètres d’une activité, avec l’accès de la personne à chacun.',
    document: `query Perimetres($activiteId: ID!) {
      perimetres(activiteId: $activiteId) { id slug nom groupe archive acces }
    }`,
  },
  {
    nom: 'equipe',
    methode: 'GET',
    chemin: '/activites/:activiteId/equipe',
    groupe: 'activites',
    resume: 'Les personnes de l’équipe d’une activité, sans leurs adresses.',
    document: `query Equipe($activiteId: ID!) {
      equipe(activiteId: $activiteId) { id nom archive }
    }`,
  },
  {
    nom: 'tachesParPerimetre',
    methode: 'GET',
    chemin: '/activites/:activiteId/taches',
    groupe: 'taches',
    resume:
      'Les tâches d’une période, rangées par périmètre. Un périmètre sans accès rend une liste vide.',
    document: `query TachesParPerimetre($activiteId: ID!, $editionId: ID!) {
      perimetres(activiteId: $activiteId) {
        id
        slug
        nom
        acces
        taches(editionId: $editionId) { ${TACHE_COURTE} }
      }
    }`,
  },
  {
    nom: 'mesTaches',
    methode: 'GET',
    chemin: '/editions/:editionId/mes-taches',
    groupe: 'taches',
    resume: 'Les tâches assignées à la personne pour une période.',
    document: `query MesTaches($editionId: ID!) {
      mesTaches(editionId: $editionId) { ${TACHE} }
    }`,
  },
  {
    nom: 'priorites',
    methode: 'GET',
    chemin: '/editions/:editionId/priorites',
    groupe: 'taches',
    resume:
      'Les priorités d’une période, par périmètre, avec le score et ses raisons.',
    document: `query Priorites($editionId: ID!) {
      priorites(editionId: $editionId) {
        fin
        perimetres {
          perimetre { id slug nom }
          autres
          priorites {
            score
            raisons { code points jours nombre titre }
            tache { id titre statut echeance }
          }
        }
      }
    }`,
  },
  {
    nom: 'tache',
    methode: 'GET',
    chemin: '/taches/:id',
    groupe: 'taches',
    resume: 'Une tâche.',
    document: `query Tache($id: ID!) { tache(id: $id) { ${TACHE} } }`,
  },
  {
    nom: 'filTache',
    methode: 'GET',
    chemin: '/taches/:id/commentaires',
    groupe: 'taches',
    resume: 'Les commentaires d’une tâche.',
    document: `query FilTache($id: ID!) {
      filTache(id: $id) {
        tacheId
        nombreCommentaires
        commentaires { id texte creeLe modifieLe auteur { id nom } }
      }
    }`,
  },
  {
    nom: 'creerTache',
    methode: 'POST',
    chemin: '/taches',
    groupe: 'taches',
    statut: 201,
    resume: 'Crée une tâche dans un périmètre où la personne écrit.',
    document: `mutation CreerTache(
      $perimetreId: ID!
      $editionId: ID!
      $titre: String!
      $description: String
      $echeance: Date
      $mAssigner: Boolean
    ) {
      creerTache(
        perimetreId: $perimetreId
        editionId: $editionId
        titre: $titre
        description: $description
        echeance: $echeance
        mAssigner: $mAssigner
      ) { ${TACHE} }
    }`,
  },
  {
    nom: 'modifierTache',
    methode: 'PATCH',
    chemin: '/taches/:id',
    groupe: 'taches',
    resume:
      'Modifie une tâche. `versionAttendue` refuse d’écraser une modification faite entre-temps (409).',
    document: `mutation ModifierTache(
      $id: ID!
      $titre: String
      $description: String
      $echeance: Date
      $versionAttendue: Int
      $confirmer: Boolean
    ) {
      modifierTache(
        id: $id
        titre: $titre
        description: $description
        echeance: $echeance
        versionAttendue: $versionAttendue
        confirmer: $confirmer
      ) { ${TACHE} }
    }`,
  },
  {
    nom: 'changerStatutTache',
    methode: 'POST',
    chemin: '/taches/:id/statut',
    groupe: 'taches',
    resume:
      'Change le statut d’une tâche. `statutAttendu` refuse d’écraser un changement fait entre-temps (409).',
    document: `mutation ChangerStatutTache(
      $id: ID!
      $statut: StatutTache!
      $statutAttendu: StatutTache
      $realisateurs: [ID!]
      $confirmer: Boolean
    ) {
      changerStatutTache(
        id: $id
        statut: $statut
        statutAttendu: $statutAttendu
        realisateurs: $realisateurs
        confirmer: $confirmer
      ) { ${TACHE} }
    }`,
  },
  {
    nom: 'assignerTache',
    methode: 'POST',
    chemin: '/taches/:id/assignation',
    groupe: 'taches',
    resume:
      'Assigne une tâche à une personne affectée à son périmètre, ou l’en retire.',
    document: `mutation AssignerTache($id: ID!, $assigne: Boolean!, $personneId: ID) {
      assignerTache(id: $id, assigne: $assigne, personneId: $personneId) { ${TACHE} }
    }`,
  },
  {
    nom: 'commenterTache',
    methode: 'POST',
    chemin: '/taches/:id/commentaires',
    groupe: 'taches',
    statut: 201,
    resume: 'Ajoute un commentaire à une tâche.',
    document: `mutation CommenterTache($id: ID!, $texte: String!) {
      commenterTache(id: $id, texte: $texte) {
        tacheId
        nombreCommentaires
        commentaires { id texte creeLe modifieLe auteur { id nom } }
      }
    }`,
  },
  {
    nom: 'fiches',
    methode: 'GET',
    chemin: '/activites/:activiteId/fiches',
    groupe: 'fiches',
    resume: 'Les fiches d’une activité que la personne lit, sans leur contenu.',
    document: `query Fiches($activiteId: ID!) {
      fiches(activiteId: $activiteId) {
        id slug titre archive modifieeLe perimetre { id slug nom }
      }
    }`,
  },
  {
    nom: 'fiche',
    methode: 'GET',
    chemin: '/activites/:activiteId/fiches/:slug',
    groupe: 'fiches',
    resume: 'Une fiche et son contenu en Markdown, ou null.',
    document: `query Fiche($activiteId: ID!, $slug: String!) {
      fiche(activiteId: $activiteId, slug: $slug) {
        id slug titre contenu archive modifieeLe perimetre { id slug nom }
      }
    }`,
  },
]
