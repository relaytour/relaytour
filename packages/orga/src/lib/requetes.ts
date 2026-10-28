import { graphql } from '../gql'

// Requêtes partagées par plusieurs écrans.

export const MOI = graphql(`
  query Moi {
    moi {
      id
      nom
      email
      estAdmin
    }
  }
`)

// La langue choisie par la personne (ADR 0047). Sans session, `moi` vaut null.
export const LANGUE_DE_MOI = graphql(`
  query LangueDeMoi {
    moi {
      id
      langue
    }
  }
`)

// Réservée aux personnes connectées : elle ne fait pas partie de la requête de session.
export const EDITION_COURANTE = graphql(`
  query EditionCourante {
    editionCourante {
      id
      annee
      nom
      debut
      fin
      statut
    }
  }
`)

export const EDITIONS = graphql(`
  query Editions {
    editions {
      id
      annee
      nom
      debut
      fin
      statut
    }
  }
`)

export const PERIMETRES = graphql(`
  query Perimetres($inclureArchives: Boolean) {
    perimetres(inclureArchives: $inclureArchives) {
      id
      slug
      nom
      description
      type
      groupe
      couleur
      ordre
      archive
      version
    }
  }
`)

// Les activités de l'organisation active, archivées comprises : une adresse peut
// désigner une activité archivée, toujours consultable (ADR 0008).
export const ACTIVITES = graphql(`
  query Activites {
    activites(inclureArchives: true) {
      id
      slug
      nom
      sigle
      nature
      ordre
      archive
      estAdministree
      souhaitsOuverts
      adressesOrganigramme
      formulaireOuvert
      modules
      modulesAutorises
      formulaire {
        introduction
        question
        paliers
      }
      acces
      groupes {
        cle
        libelle
        libellePluriel
      }
      phases {
        cle
        libelle
        jusquA
      }
      logoUrl
      contactRecrutement
      pageEquipe
      theme {
        ...ThemeChamps
      }
      identite {
        contactRecrutement
        pageEquipe
        logoPng
        logoSvg
        logoUrl
        theme
      }
    }
  }
`)

// Les organisations de la personne connectée, pour choisir l'organisation active.
export const MES_ORGANISATIONS = graphql(`
  query MesOrganisations {
    mesOrganisations {
      slug
      nom
      sigle
      estAdmin
      statut
      active
    }
  }
`)

// Affecter une personne à un périmètre et retirer une affectation : l'écran Équipe
// et la fenêtre d'un compte partagent ces deux écritures.
export const AFFECTER = graphql(`
  mutation Affecter($personneId: ID!, $perimetreId: ID!, $editionId: ID!) {
    affecter(
      personneId: $personneId
      perimetreId: $perimetreId
      editionId: $editionId
    ) {
      id
    }
  }
`)

export const RETIRER_AFFECTATION = graphql(`
  mutation RetirerAffectation($id: ID!) {
    retirerAffectation(id: $id)
  }
`)

// Nommer ou retirer un admin d'activité (ADR 0010, 0019) : la fenêtre d'un compte et
// l'écran « Admins » partagent cette écriture.
export const DEFINIR_ADMIN_ACTIVITE = graphql(`
  mutation DefinirAdminActivite(
    $personneId: ID!
    $activiteId: ID!
    $admin: Boolean!
  ) {
    definirAdminActivite(
      personneId: $personneId
      activiteId: $activiteId
      admin: $admin
    )
  }
`)

// L'avancement des tâches de chaque périmètre d'une période, pour la vue
// « Avancement » de l'écran « Équipe ».
export const AVANCEMENT_GLOBAL = graphql(`
  query AvancementGlobal($editionId: ID!) {
    avancementGlobal(editionId: $editionId) {
      perimetre {
        id
      }
      avancement {
        total
        aFaire
        enCours
        faites
        abandonnees
        enRetard
        sansPersonne
      }
    }
  }
`)

// Les personnes qu'une réunion ou un sondage peut viser (ADR 0037).
export const CONVOCABLES = graphql(`
  query PersonnesConvocables($editionId: ID!, $perimetreId: ID) {
    personnesConvocables(editionId: $editionId, perimetreId: $perimetreId) {
      personneId
      nom
      duPerimetre
    }
  }
`)

// Les lieux d'une activité et ses fiches bénévoles (ADR 0040).
export const LIEUX = graphql(`
  query Lieux($activiteId: ID!) {
    lieux(activiteId: $activiteId) {
      id
      nom
      description
      ordre
      archive
    }
  }
`)

export const BENEVOLES = graphql(`
  query Benevoles($activiteId: ID!) {
    benevoles(activiteId: $activiteId) {
      id
      nom
      courriel
      telephone
      note
      coordonneesVisibles
      peutModifier
      places
      accordLe
      origine
      prevenirParMail
      confirmeeLe
      lienEnvoyeLe
      lienRenvoyable
      lienEspace
    }
  }
`)

// Liste « Premiers pas » d'une activité (ADR 0048), lue par Mon espace et le menu
// du compte.
export const PREMIERS_PAS = graphql(`
  query PremiersPas {
    premiersPas {
      etapes {
        etape
        faite
      }
      masques
      termines
    }
  }
`)
