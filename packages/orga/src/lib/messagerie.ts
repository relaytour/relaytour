// Choix de la messagerie qui reçoit un message préparé (ADR 0022).
//
// Un lien `mailto:` ouvre la messagerie par défaut du poste, et une page web ne
// peut pas en désigner une autre. L'admin choisit donc une cible : la messagerie
// par défaut, une messagerie en ligne ouverte dans un onglet, ou une application
// ouverte par son schéma d'URL. Le choix se garde dans le navigateur, parce qu'il
// dépend de l'appareil : une application installée sur un téléphone ne l'est pas
// sur un ordinateur.

import { lienMailto, type Envoi } from './messages'

export type CleMessagerie =
  | 'defaut'
  | 'gmail'
  | 'outlook'
  | 'outlook-perso'
  | 'yahoo'
  | 'proton'
  | 'app-gmail'
  | 'app-outlook'

/**
 * La façon d'ouvrir la cible : le lien `mailto:` du poste, une page web dans un
 * nouvel onglet, ou une application par son schéma d'URL.
 */
export type GenreMessagerie = 'poste' | 'web' | 'application'

export interface Messagerie {
  cle: CleMessagerie
  libelle: string
  genre: GenreMessagerie
  /** Ce que l'admin doit savoir avant de choisir cette cible. */
  detail: string
  /**
   * Vrai quand la cible reprend les champs « Cc » et « Cci » de façon établie.
   * Faux quand son éditeur ne le documente pas : l'admin relit alors ces champs.
   */
  copiesEtablies: boolean
  /** Les systèmes où l'application répond à son schéma d'URL. */
  systemes?: string
  /**
   * Le signe qui sépare des adresses copiées, à coller dans cette cible. Null
   * pour la messagerie par défaut : l'application qui s'ouvre n'est pas connue,
   * et le réglage de la personne tranche.
   */
  separateur: Separateur | null
}

/**
 * Le signe placé entre deux adresses copiées. La norme des mails emploie la
 * virgule ; Outlook attend un point-virgule et ne découpe pas une liste collée
 * avec des virgules.
 */
export type Separateur = ',' | ';'

export const SEPARATEURS: Record<Separateur, string> = {
  ',': 'Virgule',
  ';': 'Point-virgule',
}

export const MESSAGERIE_PAR_DEFAUT: CleMessagerie = 'defaut'

export const MESSAGERIES: readonly Messagerie[] = [
  {
    cle: 'defaut',
    libelle: 'Messagerie par défaut de l’appareil',
    genre: 'poste',
    detail:
      'Votre appareil ouvre l’application de mail réglée par défaut dans votre système ou dans votre navigateur.',
    copiesEtablies: true,
    separateur: null,
  },
  {
    cle: 'gmail',
    libelle: 'Gmail',
    genre: 'web',
    detail:
      'Gmail s’ouvre dans un nouvel onglet, avec le compte Google connecté dans ce navigateur.',
    copiesEtablies: true,
    separateur: ',',
  },
  {
    cle: 'outlook',
    libelle: 'Outlook (compte professionnel ou associatif)',
    genre: 'web',
    detail:
      'Outlook sur le web s’ouvre dans un nouvel onglet, avec le compte Microsoft 365 connecté dans ce navigateur.',
    copiesEtablies: true,
    separateur: ';',
  },
  {
    cle: 'outlook-perso',
    libelle: 'Outlook.com (compte personnel)',
    genre: 'web',
    detail:
      'Outlook.com s’ouvre dans un nouvel onglet, avec le compte Microsoft personnel connecté dans ce navigateur.',
    copiesEtablies: false,
    separateur: ';',
  },
  {
    cle: 'yahoo',
    libelle: 'Yahoo Mail',
    genre: 'web',
    detail:
      'Yahoo Mail s’ouvre dans un nouvel onglet, avec le compte connecté dans ce navigateur.',
    copiesEtablies: false,
    separateur: ',',
  },
  {
    cle: 'proton',
    libelle: 'Proton Mail',
    genre: 'web',
    detail:
      'Proton Mail s’ouvre dans un nouvel onglet, avec le compte connecté dans ce navigateur.',
    copiesEtablies: true,
    separateur: ',',
  },
  {
    cle: 'app-gmail',
    libelle: 'Application Gmail',
    genre: 'application',
    detail:
      'Le lien ouvre l’application Gmail installée sur l’appareil. Google ne documente pas ce lien.',
    copiesEtablies: false,
    systemes: 'iPhone et iPad seulement',
    separateur: ',',
  },
  {
    cle: 'app-outlook',
    libelle: 'Application Outlook',
    genre: 'application',
    detail:
      'Le lien ouvre l’application Outlook installée sur l’appareil. Microsoft ne documente pas ce lien.',
    copiesEtablies: false,
    systemes: 'iPhone, iPad et Android, ni Mac ni Windows',
    separateur: ';',
  },
]

/** Les titres des groupes d'un sélecteur de messagerie. */
export const GENRES: Record<GenreMessagerie, string> = {
  poste: 'Votre appareil',
  web: 'Messageries en ligne',
  application: 'Applications (à essayer)',
}

export function messagerie(cle: CleMessagerie): Messagerie {
  return MESSAGERIES.find(m => m.cle === cle) ?? MESSAGERIES[0]!
}

function estUneCle(valeur: unknown): valeur is CleMessagerie {
  return MESSAGERIES.some(m => m.cle === valeur)
}

// ── Lien de composition ──────────────────────────────────────────────────────

const coder = (texte: string) =>
  encodeURIComponent(texte.replace(/\r?\n/g, '\r\n'))

/**
 * Les paramètres d'une adresse de composition. Un champ vide ne s'écrit pas, et
 * une espace se code `%20` : certaines messageries affichent un `+` tel quel.
 */
function parametres(
  champs: readonly (readonly [string, string | string[]])[]
): string {
  return champs
    .map(([nom, valeur]) => [
      nom,
      typeof valeur === 'string' ? valeur : valeur.join(','),
    ])
    .filter(([, valeur]) => valeur !== '')
    .map(([nom, valeur]) => `${nom}=${coder(valeur!)}`)
    .join('&')
}

const avec = (base: string, requete: string, separateur = '?') =>
  requete === '' ? base : `${base}${separateur}${requete}`

/** Les champs que partagent Yahoo Mail et les schémas d'application. */
const champsCourants = ({ a, cc, cci, objet, corps }: Envoi) =>
  parametres([
    ['to', a],
    ['cc', cc],
    ['bcc', cci],
    ['subject', objet],
    ['body', corps],
  ])

/** L'adresse qui ouvre un message dans la cible choisie. */
export function lienVers(cle: CleMessagerie, envoi: Envoi): string {
  switch (cle) {
    case 'defaut':
      return lienMailto(envoi)
    case 'gmail':
      return avec(
        'https://mail.google.com/mail/?view=cm&fs=1',
        parametres([
          ['to', envoi.a],
          ['cc', envoi.cc],
          ['bcc', envoi.cci],
          ['su', envoi.objet],
          ['body', envoi.corps],
        ]),
        '&'
      )
    // Outlook sur le web ignore un paramètre `bcc`. Il lit en revanche un lien
    // `mailto:` entier, la forme qu'il emploie comme gestionnaire de ces liens.
    // Le compte professionnel vise `outlook.cloud.microsoft` : depuis
    // `outlook.office.com`, une reconnexion change de domaine et perd le message.
    case 'outlook':
      return `https://outlook.cloud.microsoft/mail/deeplink/compose?mailtouri=${encodeURIComponent(lienMailto(envoi))}`
    case 'outlook-perso':
      return `https://outlook.live.com/mail/0/deeplink/compose?mailtouri=${encodeURIComponent(lienMailto(envoi))}`
    case 'yahoo':
      return avec('https://compose.mail.yahoo.com/', champsCourants(envoi))
    case 'proton':
      // Proton Mail lit un lien `mailto:` entier dans le fragment : rien de ce
      // lien ne part vers son serveur.
      return `https://mail.proton.me/inbox/#mailto=${encodeURIComponent(lienMailto(envoi))}`
    case 'app-gmail':
      return avec('googlegmail:///co', champsCourants(envoi))
    case 'app-outlook':
      return avec('ms-outlook://compose', champsCourants(envoi))
  }
}

// ── Choix gardé dans le navigateur ───────────────────────────────────────────

const CLE_STOCKAGE = 'relaytour.messagerie'

type Stockage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function stockageDuNavigateur(): Stockage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** La messagerie choisie dans ce navigateur, sinon la messagerie par défaut. */
export function lireMessagerie(
  stockage = stockageDuNavigateur()
): CleMessagerie {
  try {
    const lue = stockage?.getItem(CLE_STOCKAGE)
    return estUneCle(lue) ? lue : MESSAGERIE_PAR_DEFAUT
  } catch {
    return MESSAGERIE_PAR_DEFAUT
  }
}

/** Garde le choix dans ce navigateur. Faux quand le stockage le refuse. */
export function enregistrerMessagerie(
  cle: CleMessagerie,
  stockage = stockageDuNavigateur()
): boolean {
  if (stockage === null) return false
  try {
    if (cle === MESSAGERIE_PAR_DEFAUT) stockage.removeItem(CLE_STOCKAGE)
    else stockage.setItem(CLE_STOCKAGE, cle)
    return true
  } catch {
    return false
  }
}

const CLE_SEPARATEUR = 'relaytour.messagerie.separateur'

/** Le séparateur réglé pour la messagerie par défaut, sinon la virgule. */
export function lireSeparateur(stockage = stockageDuNavigateur()): Separateur {
  try {
    return stockage?.getItem(CLE_SEPARATEUR) === ';' ? ';' : ','
  } catch {
    return ','
  }
}

/** Garde le séparateur dans ce navigateur. Faux quand le stockage le refuse. */
export function enregistrerSeparateur(
  separateur: Separateur,
  stockage = stockageDuNavigateur()
): boolean {
  if (stockage === null) return false
  try {
    if (separateur === ',') stockage.removeItem(CLE_SEPARATEUR)
    else stockage.setItem(CLE_SEPARATEUR, separateur)
    return true
  } catch {
    return false
  }
}

/**
 * Le séparateur proposé pour des adresses à coller dans une cible : celui de la
 * cible, ou le réglage de la personne pour la messagerie par défaut.
 */
export function separateurPropose(
  cle: CleMessagerie,
  reglage: Separateur = lireSeparateur()
): Separateur {
  return messagerie(cle).separateur ?? reglage
}

// ── Ouverture ────────────────────────────────────────────────────────────────

/** Vrai pour une page web : elle s'ouvre dans un nouvel onglet. */
export function ouvreUnOnglet(lien: string): boolean {
  return lien.startsWith('https://')
}

/**
 * Réserve l'onglet d'une cible web pendant le clic. Un navigateur bloque un
 * onglet ouvert après une attente, par exemple l'enregistrement du message : la
 * fenêtre le réserve donc d'abord, vide, puis y charge la messagerie. Null pour
 * une cible sans onglet, ou quand le navigateur refuse l'onglet.
 */
export function reserverOnglet(lien: string): Window | null {
  return ouvreUnOnglet(lien) ? window.open('about:blank', '_blank') : null
}

/**
 * Ouvre la cible : l'onglet réservé ou un nouvel onglet pour une page web, sinon
 * l'application. L'onglet réservé perd son lien avec l'espace organisateur avant
 * de charger la messagerie.
 */
export function ouvrirLaMessagerie(
  lien: string,
  onglet: Window | null = null
): void {
  if (onglet !== null && !onglet.closed) {
    onglet.opener = null
    onglet.location.replace(lien)
    return
  }
  const ancre = document.createElement('a')
  ancre.href = lien
  if (ouvreUnOnglet(lien)) {
    ancre.target = '_blank'
    ancre.rel = 'noopener noreferrer'
  }
  ancre.click()
}

/** Durée d'observation après l'ouverture d'une application, en millisecondes. */
export const DELAI_ESSAI = 2500

/**
 * Observe si la page perd la main après l'ouverture d'un lien. Une application
 * qui s'ouvre, ou la question du navigateur qui la précède, retire le focus à la
 * page. Aucun navigateur ne dit si une application répond à un schéma d'URL : ce
 * signal est un indice, et la réponse de la personne tranche.
 */
export function observerOuverture(delai = DELAI_ESSAI): Promise<boolean> {
  return new Promise(resoudre => {
    const finir = (ouverte: boolean) => {
      window.clearTimeout(minuterie)
      window.removeEventListener('blur', vue)
      document.removeEventListener('visibilitychange', masquee)
      resoudre(ouverte)
    }
    const vue = () => finir(true)
    const masquee = () => {
      if (document.visibilityState === 'hidden') finir(true)
    }
    const minuterie = window.setTimeout(() => finir(false), delai)
    window.addEventListener('blur', vue)
    document.addEventListener('visibilitychange', masquee)
  })
}

/** Le message d'essai : il s'adresse à la personne elle-même et se supprime sans envoi. */
export function envoiDEssai(adresse: string): Envoi {
  return {
    a: [adresse],
    cc: [],
    cci: [adresse],
    objet: 'Essai de votre messagerie',
    corps:
      'Ce message d’essai vérifie que votre messagerie s’ouvre depuis l’espace organisateur.\n\nVotre adresse figure dans les champs « À » et « Cci ». Vous pouvez fermer ce message sans l’envoyer.',
  }
}

// ── Mode d'emploi ────────────────────────────────────────────────────────────

/**
 * Adresse de la page « Choisir votre messagerie », à côté de la liste des modes
 * d'emploi. La liste peut être un dossier ou une page : la page se place dans le
 * même dossier.
 */
export function lienGuideMessagerie(modesDEmploi: string): string {
  try {
    const liste = new URL(modesDEmploi)
    liste.search = ''
    liste.hash = ''
    const dernier = liste.pathname.split('/').at(-1) ?? ''
    if (dernier !== '' && !dernier.includes('.')) liste.pathname += '/'
    return new URL('messagerie.html', liste).toString()
  } catch {
    return modesDEmploi
  }
}
