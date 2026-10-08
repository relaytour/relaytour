// Messages (ADR 0020). Un admin prépare un message dans l'espace organisateur, puis
// l'envoie depuis sa propre messagerie : l'application n'envoie rien. Ce module
// compose le texte d'un modèle avec les informations de l'application, et construit
// le lien qui ouvre la messagerie.
//
// Un message groupé porte le même texte pour chaque destinataire : aucune
// information ne change d'une personne à l'autre.

export type ChampDestinataires = 'A' | 'CC' | 'CCI'
export type StatutMessage = 'EN_COURS' | 'ENVOYE' | 'ANNULE'

export const STATUTS_MESSAGE: Record<
  StatutMessage,
  { libelle: string; couleur?: string }
> = {
  EN_COURS: { libelle: 'En cours', couleur: 'gold' },
  ENVOYE: { libelle: 'Envoyé', couleur: 'green' },
  ANNULE: { libelle: 'Annulé' },
}

export const CHAMPS: Record<ChampDestinataires, string> = {
  A: 'À',
  CC: 'Cc',
  CCI: 'Cci',
}

/** Bornes de saisie, identiques à celles du serveur. */
export const OBJET_MAX = 200
export const CORPS_MAX = 10_000
export const DESTINATAIRES_MAX = 500

// ── Informations de l'application ────────────────────────────────────────────

/**
 * Les informations qu'un modèle ou l'admin insère dans un message. Une valeur
 * `null` manque : le texte garde un passage à compléter. Une valeur vide
 * disparaît du texte.
 */
export interface Informations {
  salutation: string
  signature: string
  organisation: string
  activite: string
  periode: string | null
  dates: string | null
  perimetre: string | null
  lienEspace: string
  lienPerimetre: string | null
  tachesEnCours: string | null
  tachesEnRetard: string | null
  postesAPourvoir: string | null
  invitationFormulaire: string
  contact: string | null
  pageEquipe: string | null
}

export type CleInformation = keyof Informations

/** Le libellé de chaque information, dans le menu d'insertion et dans un passage à compléter. */
export const LIBELLES: Record<CleInformation, string> = {
  salutation: 'formule de salutation',
  signature: 'signature',
  organisation: 'nom de l’organisation',
  activite: 'nom de l’activité',
  periode: 'nom de la période',
  dates: 'dates de la période',
  perimetre: 'nom du périmètre',
  lienEspace: 'adresse de l’espace organisateur',
  lienPerimetre: 'adresse du périmètre',
  tachesEnCours: 'tâches en cours',
  tachesEnRetard: 'tâches en retard',
  postesAPourvoir: 'périmètres à pourvoir',
  invitationFormulaire: 'lien du formulaire public',
  contact: 'adresse de contact',
  pageEquipe: 'page de l’équipe',
}

/** Les informations proposées dans le menu d'insertion, dans cet ordre. */
export const INSERABLES: CleInformation[] = [
  'organisation',
  'activite',
  'periode',
  'dates',
  'perimetre',
  'lienEspace',
  'lienPerimetre',
  'tachesEnCours',
  'tachesEnRetard',
  'postesAPourvoir',
  'invitationFormulaire',
  'contact',
  'pageEquipe',
]

/** Le passage qui remplace une information manquante. */
export function aCompleter(libelle: string): string {
  return `[à compléter : ${libelle}]`
}

/** La valeur d'une information dans le texte, ou son passage à compléter. */
export function valeur(
  cle: CleInformation,
  informations: Informations
): string {
  return informations[cle] ?? aCompleter(LIBELLES[cle])
}

const JETON = /\{\{([a-zA-Z]+)\}\}/g

/**
 * Remplace chaque `{{information}}` du texte d'un modèle. Une information vide
 * laisse un paragraphe vide : trois sauts de ligne ou plus n'en font que deux.
 */
export function composer(texte: string, informations: Informations): string {
  return texte
    .replace(JETON, (jeton, cle: string) =>
      cle in LIBELLES ? valeur(cle as CleInformation, informations) : jeton
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Les passages entre crochets que l'admin doit encore remplacer. */
export function passagesACompleter(texte: string): string[] {
  return [...new Set(texte.match(/\[[^\]\n]{2,}\]/g) ?? [])]
}

/** La formule de salutation : le prénom pour une seule personne. */
export function salutation(prenom: string | null): string {
  return prenom ? `Bonjour ${prenom},` : 'Bonjour à toutes et à tous,'
}

/** Nombre de tâches listées dans un message ; les suivantes se résument en une ligne. */
export const TACHES_MAX = 30

export interface TacheListee {
  titre: string
  /** Date sans heure, déjà formatée, ou null. */
  echeance: string | null
  /** Nom du périmètre, affiché quand la liste couvre plusieurs périmètres. */
  perimetre: string | null
}

/** Une liste de tâches, une par ligne. */
export function listerTaches(taches: TacheListee[], aucune: string): string {
  if (taches.length === 0) return aucune
  const lignes = taches.slice(0, TACHES_MAX).map(t => {
    const titre = t.perimetre ? `${t.perimetre} : ${t.titre}` : t.titre
    return t.echeance ? `- ${titre} (échéance : ${t.echeance})` : `- ${titre}`
  })
  const reste = taches.length - lignes.length
  if (reste > 0) {
    lignes.push(
      reste === 1 ? '- et une autre tâche' : `- et ${reste} autres tâches`
    )
  }
  return lignes.join('\n')
}

// ── Modèles ──────────────────────────────────────────────────────────────────

export interface Modele {
  /** Clé gardée avec le message : des minuscules, des chiffres et des tirets. */
  cle: string
  libelle: string
  description: string
  objet: string
  corps: string
}

export const MODELE_LIBRE = 'message-libre'
export const MODELE_PERIMETRE = 'perimetre'

export const MODELES: Modele[] = [
  {
    cle: MODELE_LIBRE,
    libelle: 'Message libre',
    description: 'Un message sans texte préparé.',
    objet: '',
    corps: `{{salutation}}

[Écrivez ici votre message.]

{{signature}}`,
  },
  {
    cle: 'presentation-outil',
    libelle: 'Présentation de l’espace organisateur',
    description:
      'Vous présentez l’outil et la façon de s’y connecter à des personnes qui le découvrent.',
    objet: '{{organisation}} : votre accès à l’espace organisateur',
    corps: `{{salutation}}

Nous préparons {{activite}} avec un espace organisateur en ligne. Vous y trouvez les tâches de votre périmètre, leurs échéances et les fiches qui expliquent comment les réaliser.

Vous vous connectez à cette adresse :
{{lienEspace}}

L’espace ne demande pas de mot de passe. Vous saisissez votre adresse mail, puis vous recevez un code de connexion par mail.

À votre première connexion, nous vous conseillons trois gestes :
- consulter les tâches de votre périmètre ;
- lire les fiches de votre périmètre ;
- régler la fréquence des mails dans « Préférences ».

Vous pouvez répondre à ce message pour toute question.

{{signature}}`,
  },
  {
    cle: 'lancement',
    libelle: 'Lancement de la période',
    description: 'Vous annoncez à l’équipe le début de la préparation.',
    objet: '{{periode}} : la préparation commence',
    corps: `{{salutation}}

La préparation de {{periode}} commence. Les dates retenues sont les suivantes : {{dates}}.

L’espace organisateur liste les tâches de chaque périmètre, avec leurs échéances :
{{lienEspace}}

Nous vous invitons à consulter les tâches de votre périmètre et à signaler ce qui manque.

[Ajoutez ici la date de la première réunion ou les prochaines étapes.]

Merci pour votre engagement.

{{signature}}`,
  },
  {
    cle: 'equipe',
    libelle: 'Nouvelles de l’équipe',
    description: 'Vous partagez l’avancement et les prochaines dates.',
    objet: '{{periode}} : des nouvelles de l’équipe',
    corps: `{{salutation}}

Voici les nouvelles de l’équipe de {{periode}}.

[Écrivez ici les informations à partager : avancement, décisions, prochaines dates.]

Vous retrouvez les tâches et les fiches dans l’espace organisateur :
{{lienEspace}}

{{signature}}`,
  },
  {
    cle: 'reunion',
    libelle: 'Invitation à une réunion',
    description: 'Vous invitez l’équipe à une réunion.',
    objet: '{{periode}} : réunion d’équipe',
    corps: `{{salutation}}

Nous vous invitons à une réunion de l’équipe de {{periode}}.

- Date : [date et heure]
- Lieu : [lieu ou lien de visioconférence]
- Ordre du jour : [points à aborder]

Pouvez-vous confirmer votre présence par retour de mail ?

{{signature}}`,
  },
  {
    cle: MODELE_PERIMETRE,
    libelle: 'Message à un périmètre',
    description: 'Vous écrivez aux référentes et aux référents d’un périmètre.',
    objet: '{{periode}} : point sur le périmètre {{perimetre}}',
    corps: `{{salutation}}

Ce message concerne le périmètre {{perimetre}} pour {{periode}}.

[Écrivez ici votre message.]

Vous retrouvez les tâches et les fiches du périmètre à cette adresse :
{{lienPerimetre}}

{{signature}}`,
  },
  {
    cle: 'taches-en-cours',
    libelle: 'Rappel des tâches en cours',
    description:
      'Le message liste les tâches encore ouvertes du périmètre choisi, ou de toute la période.',
    objet: '{{periode}} : rappel des tâches en cours',
    corps: `{{salutation}}

Voici les tâches encore ouvertes pour {{periode}} :

{{tachesEnCours}}

Vous pouvez indiquer l’avancement de chaque tâche dans l’espace organisateur :
{{lienEspace}}

Merci pour votre aide.

{{signature}}`,
  },
  {
    cle: 'taches-en-retard',
    libelle: 'Rappel des tâches en retard',
    description:
      'Le message liste les tâches qui ont dépassé leur échéance, pour le périmètre choisi ou pour toute la période.',
    objet: '{{periode}} : des tâches ont dépassé leur échéance',
    corps: `{{salutation}}

Ces tâches ont dépassé leur échéance :

{{tachesEnRetard}}

Pouvez-vous indiquer leur avancement dans l’espace organisateur ?
{{lienEspace}}

Si une tâche ne peut plus être réalisée, vous pouvez l’abandonner ou nous prévenir par retour de mail.

{{signature}}`,
  },
  {
    cle: 'jour-j',
    libelle: 'Arrivée le jour J',
    description:
      'Vous donnez à l’équipe les informations pratiques du premier jour.',
    objet: '{{periode}} : informations pour le jour J',
    corps: `{{salutation}}

{{periode}} approche. Les dates retenues sont les suivantes : {{dates}}.

Voici les informations pratiques pour votre arrivée :
- Heure d’arrivée : [heure]
- Lieu de rendez-vous : [lieu]
- Personne à contacter sur place : [nom et numéro]

Vous retrouvez vos tâches dans l’espace organisateur :
{{lienEspace}}

Merci pour votre présence.

{{signature}}`,
  },
  {
    cle: 'appel-equipe',
    libelle: 'Appel à rejoindre l’équipe',
    description:
      'Le message liste les périmètres qui manquent de référentes et de référents.',
    objet: '{{periode}} : rejoignez l’équipe d’organisation',
    corps: `{{salutation}}

Nous préparons {{periode}}. Nous cherchons encore des référentes et des référents pour ces périmètres :

{{postesAPourvoir}}

{{invitationFormulaire}}

Vous pouvez aussi répondre à ce message pour proposer votre aide.

{{signature}}`,
  },
  {
    cle: 'appel-benevoles',
    libelle: 'Appel à bénévoles',
    description: 'Vous cherchez des bénévoles pour aider pendant l’événement.',
    objet: '{{periode}} : nous cherchons des bénévoles',
    corps: `{{salutation}}

Nous cherchons des bénévoles pour {{periode}}. Les dates retenues sont les suivantes : {{dates}}.

Nous avons besoin d’aide pour ces missions :
- [mission, jour et horaire]
- [mission, jour et horaire]

Vous pouvez transmettre ce message aux personnes de votre entourage.

Pour proposer votre aide, vous pouvez répondre à ce message.

{{signature}}`,
  },
  {
    cle: 'remerciements',
    libelle: 'Remerciements',
    description: 'Vous remerciez l’équipe à la fin de la période.',
    objet: '{{periode}} : merci',
    corps: `{{salutation}}

Nous arrivons au terme de {{periode}}. Nous vous remercions pour le temps et l’énergie que vous y avez consacrés.

[Ajoutez ici un bilan en quelques lignes : participation, points forts, suites prévues.]

Vos remarques nous aideront à préparer la suite. Vous pouvez les noter dans les fiches de votre périmètre ou nous répondre par mail.

{{signature}}`,
  },
]

/** Le libellé d'un modèle, ou sa clé pour un modèle qui n'existe plus. */
export function libelleModele(cle: string): string {
  return MODELES.find(m => m.cle === cle)?.libelle ?? cle
}

// ── Destinataires ────────────────────────────────────────────────────────────

export interface Destinataire {
  id: string
  nom: string
  email: string
}

/**
 * Le champ proposé d'office : « À » pour une seule personne, « Cci » quand toute
 * la liste est choisie, « Cc » pour une sélection.
 */
export function champParDefaut(
  nombre: number,
  toutLeMonde: boolean
): ChampDestinataires {
  if (nombre <= 1) return 'A'
  return toutLeMonde ? 'CCI' : 'CC'
}

export interface Adresses {
  a: string[]
  cc: string[]
  cci: string[]
}

/**
 * Répartit les adresses entre les champs de la messagerie. En copie cachée, le
 * champ « À » porte l'adresse de l'auteur : un message sans destinataire visible
 * est souvent classé comme indésirable.
 */
export function repartir(
  destinataires: Destinataire[],
  champ: ChampDestinataires,
  enCopie: ReadonlySet<string>,
  auteur: string
): Adresses {
  const adresses = destinataires.map(d => d.email)
  if (champ === 'A') return { a: adresses, cc: [], cci: [] }
  if (champ === 'CC') return { a: [], cc: adresses, cci: [] }
  return {
    a: [auteur],
    cc: destinataires.filter(d => enCopie.has(d.id)).map(d => d.email),
    cci: destinataires.filter(d => !enCopie.has(d.id)).map(d => d.email),
  }
}

// ── Lien vers la messagerie ──────────────────────────────────────────────────

/**
 * Longueur au-delà de laquelle une messagerie peut tronquer ou refuser un lien
 * `mailto:`. Windows limite une adresse à 2 083 caractères environ.
 */
export const LIEN_MAX = 2000

export interface Envoi extends Adresses {
  objet: string
  corps: string
}

const coder = (texte: string) =>
  encodeURIComponent(texte.replace(/\r?\n/g, '\r\n'))
const liste = (adresses: string[]) =>
  adresses.map(a => encodeURIComponent(a).replace(/%40/g, '@')).join(',')

/** Le lien `mailto:` d'un message (RFC 6068). */
export function lienMailto({ a, cc, cci, objet, corps }: Envoi): string {
  const champs = [
    cc.length > 0 ? `cc=${liste(cc)}` : null,
    cci.length > 0 ? `bcc=${liste(cci)}` : null,
    objet ? `subject=${coder(objet)}` : null,
    corps ? `body=${coder(corps)}` : null,
  ].filter(champ => champ !== null)
  return `mailto:${liste(a)}${champs.length > 0 ? `?${champs.join('&')}` : ''}`
}

/**
 * Ce que le lien ne porte pas, faute de place : rien, le texte, ou le texte et
 * les adresses. L'admin colle alors ce qui manque dans sa messagerie.
 */
export type Omission = 'rien' | 'texte' | 'adresses'

/**
 * Le lien le plus complet qui tient dans la longueur admise. Le texte part en
 * premier, puis les adresses : l'objet reste toujours. `lien` compose l'adresse
 * d'une autre cible que la messagerie par défaut (ADR 0022).
 */
export function preparerLien(
  envoi: Envoi,
  lien: (envoi: Envoi) => string = lienMailto
): { lien: string; omis: Omission } {
  const complet = lien(envoi)
  if (complet.length <= LIEN_MAX) return { lien: complet, omis: 'rien' }
  const sansTexte = lien({ ...envoi, corps: '' })
  if (sansTexte.length <= LIEN_MAX) return { lien: sansTexte, omis: 'texte' }
  return {
    lien: lien({ a: [], cc: [], cci: [], objet: envoi.objet, corps: '' }),
    omis: 'adresses',
  }
}

/**
 * Les adresses d'un champ, prêtes à être collées dans une messagerie. Outlook
 * attend un point-virgule entre deux adresses, les autres une virgule.
 */
export function adressesACopier(
  adresses: string[],
  separateur: ',' | ';' = ','
): string {
  return adresses.join(`${separateur} `)
}
