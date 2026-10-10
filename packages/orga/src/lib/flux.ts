// Flux des changements, côté navigateur (ADR 0017).
//
// Le serveur signale chaque changement : une entité et des identifiants, jamais de
// donnée. À chaque signal, l'espace organisateur relit en silence les requêtes des
// écrans concernés (lib/rafraichissement.ts), avec les droits de la personne.
//
// Le flux est un accélérateur. Il s'ouvre sur un onglet visible et en ligne, se ferme
// quand l'onglet est caché, et se rouvre au retour. Sans lui, les écrans gardent leur
// relecture périodique : rien ne dépend de son ouverture.

export type EntiteChangee =
  | 'TACHE'
  | 'FICHE'
  | 'PERIMETRE'
  | 'EQUIPE'
  | 'DEMANDE'
  | 'NOTIFICATION'
  | 'MESSAGE'

// Les requêtes qui affichent des tâches, et celles qui affichent des fiches.
const VUES_DES_TACHES = [
  'PagePerimetre',
  'MesTaches',
  'AvancementGlobal',
  'Retroplanning',
  'TachesFiche',
  'DeclinaisonsProposees',
  'DeclinaisonsTache',
  'CommentairesDeLaPeriode',
  'FilTache',
] as const
const VUES_DES_FICHES = ['ListeFiches', 'Fiche', 'FichesDuPerimetre'] as const
const VUES_DES_PERIMETRES = [
  'MenuPerimetres',
  'TousLesPerimetres',
  'PostesAPourvoir',
] as const

/**
 * Les requêtes à relire quand une entité change, par le nom de leur opération. Une
 * requête figure sous chaque entité dont elle affiche une donnée ou dont dépendent
 * ses droits :
 *
 * - la page d'un périmètre liste les fiches communes dans son formulaire de tâche ;
 * - le nom et la couleur d'un périmètre s'affichent avec chaque tâche et chaque fiche ;
 * - les affectations décident des tâches à prendre, des référentes et référents
 *   affichés, et du droit de lire ou de rédiger une fiche.
 */
const REQUETES_PAR_ENTITE: Record<EntiteChangee, readonly string[]> = {
  TACHE: VUES_DES_TACHES,
  FICHE: [...VUES_DES_FICHES, 'PagePerimetre'],
  PERIMETRE: [...VUES_DES_PERIMETRES, ...VUES_DES_TACHES, ...VUES_DES_FICHES],
  EQUIPE: [
    ...VUES_DES_PERIMETRES,
    ...VUES_DES_TACHES,
    ...VUES_DES_FICHES,
    'SouhaitsEnAttente',
  ],
  DEMANDE: [
    'Demandes',
    'DemandesEnAttente',
    'PostesAPourvoir',
    'MesPropositions',
  ],
  NOTIFICATION: ['NombreNotificationsNonLues', 'ListeNotifications'],
  // L'historique des messages (ADR 0020), lu par les admins.
  MESSAGE: ['Messages'],
}

/** Les requêtes à relire pour un lot de signaux, sans doublon. */
export function requetesPour(entites: Iterable<EntiteChangee>): string[] {
  const noms = new Set<string>()
  for (const entite of entites) {
    // Une entité inconnue vient d'un serveur plus récent : elle ne relit rien.
    for (const nom of REQUETES_PAR_ENTITE[entite] ?? []) noms.add(nom)
  }
  return [...noms]
}

/** Durée pendant laquelle les signaux se regroupent avant une relecture. */
export const REGROUPEMENT_MS = 400
/** Attente avant de rouvrir un flux quand la personne en a déjà trop d'ouverts. */
export const ATTENTE_TROP_DE_FLUX_MS = 5 * 60 * 1000

/** L'attente avant de rouvrir un flux tombé en panne : 1, 2, 4… puis 30 secondes. */
export function delaiDeReprise(echecs: number): number {
  return Math.min(30_000, 1_000 * 2 ** Math.max(0, echecs - 1))
}

/**
 * Pourquoi un flux s'est terminé. `terminee` : le serveur l'a fermé après sa durée.
 * `panne` : le réseau ou le serveur n'ont pas répondu. `trop` : la personne a déjà
 * trop de flux ouverts. `refus` : la session a pris fin ou les accès ont changé.
 */
export type FinDeFlux = 'terminee' | 'panne' | 'trop' | 'refus'

export interface Ecoute {
  /** Le serveur a accepté le flux. */
  ouvert: () => void
  signal: (entite: EntiteChangee) => void
  fin: (cause: FinDeFlux) => void
}

/**
 * Tient un flux ouvert tant qu'on le lui demande, et relit les écrans à chaque lot de
 * signaux. `ouvrir` ouvre un flux et renvoie de quoi le fermer ; `relire` relit les
 * requêtes nommées ; `apresOuverture` rattrape ce que le flux a pu manquer.
 */
export function creerFlux(options: {
  ouvrir: (ecoute: Ecoute) => () => void
  relire: (noms: string[]) => Promise<unknown>
  apresOuverture?: () => void
}) {
  let voulu = false
  let actif = false
  let fermer: (() => void) | null = null
  let reprise: ReturnType<typeof setTimeout> | null = null
  let echecs = 0

  const enAttente = new Set<EntiteChangee>()
  let regroupement: ReturnType<typeof setTimeout> | null = null
  let relecture = false

  const relireLeLot = () => {
    regroupement = null
    // Une relecture à la fois : les signaux arrivés entre-temps forment le lot suivant.
    if (relecture || enAttente.size === 0) return
    const noms = requetesPour(enAttente)
    enAttente.clear()
    relecture = true
    void options
      .relire(noms)
      .catch(() => undefined)
      .finally(() => {
        relecture = false
        if (enAttente.size > 0 && regroupement === null) {
          regroupement = setTimeout(relireLeLot, REGROUPEMENT_MS)
        }
      })
  }

  const ouvrir = () => {
    if (!voulu || fermer !== null) return
    // Une fin tardive d'un flux déjà remplacé ne compte pas.
    let courant = true
    const fermerCeFlux = options.ouvrir({
      ouvert: () => {
        if (!courant) return
        actif = true
        echecs = 0
        options.apresOuverture?.()
      },
      signal: entite => {
        if (!courant) return
        enAttente.add(entite)
        regroupement ??= setTimeout(relireLeLot, REGROUPEMENT_MS)
      },
      fin: cause => {
        if (!courant) return
        courant = false
        fermer = null
        actif = false
        if (!voulu || cause === 'refus') return
        if (cause === 'panne') echecs += 1
        const attente =
          cause === 'terminee'
            ? 0
            : cause === 'trop'
              ? ATTENTE_TROP_DE_FLUX_MS
              : delaiDeReprise(echecs)
        reprise = setTimeout(() => {
          reprise = null
          ouvrir()
        }, attente)
      },
    })
    fermer = () => {
      courant = false
      fermerCeFlux()
    }
  }

  return {
    /** Ouvre le flux, ou le rouvre après un refus ou une fermeture. */
    demarrer() {
      voulu = true
      if (reprise !== null) {
        clearTimeout(reprise)
        reprise = null
      }
      ouvrir()
    },
    /** Ferme le flux et annule toute reprise. */
    arreter() {
      voulu = false
      actif = false
      echecs = 0
      if (reprise !== null) clearTimeout(reprise)
      reprise = null
      fermer?.()
      fermer = null
    },
    /** Vrai quand le serveur a accepté le flux et ne l'a pas fermé. */
    actif: () => actif,
  }
}
