// Mentions d'une fiche (ADR 0039) : `@logistique` désigne un périmètre de
// l'activité, `@groupe:sport` un groupe. Une mention s'affiche comme une étiquette
// et ne donne aucun accès. Une mention inconnue reste du texte.

export interface PerimetreMentionnable {
  id: string
  slug: string
  nom: string
  couleur: string | null
  groupe: string
}

export interface Mentions {
  perimetres: Map<string, PerimetreMentionnable>
  groupes: Map<string, { libelle: string; perimetres: PerimetreMentionnable[] }>
}

export type Segment =
  | { type: 'texte'; valeur: string }
  | { type: 'perimetre'; valeur: string; cle: string }
  | { type: 'groupe'; valeur: string; cle: string }

// Un `@` en début de texte ou après une espace, une ponctuation ouvrante ou un
// guillemet : une adresse (`contact@exemple.org`) n'est jamais une mention.
const MENTION = /(^|[\s([{«"'’])@(groupe:)?([a-z0-9]+(?:-[a-z0-9]+)*)/g

/** Découpe un texte en morceaux de texte et en mentions connues. */
export function decouper(texte: string, mentions: Mentions): Segment[] {
  const segments: Segment[] = []
  let reste = 0
  for (const trouvee of texte.matchAll(MENTION)) {
    const [entiere, avant = '', prefixe, cle = ''] = trouvee
    const groupe = prefixe !== undefined
    const connue = groupe
      ? mentions.groupes.has(cle)
      : mentions.perimetres.has(cle)
    if (!connue) continue
    const debut = (trouvee.index ?? 0) + avant.length
    if (debut > reste)
      segments.push({ type: 'texte', valeur: texte.slice(reste, debut) })
    segments.push({
      type: groupe ? 'groupe' : 'perimetre',
      valeur: entiere.slice(avant.length),
      cle,
    })
    reste = (trouvee.index ?? 0) + entiere.length
  }
  if (reste < texte.length)
    segments.push({ type: 'texte', valeur: texte.slice(reste) })
  return segments
}

/** Les périmètres et les groupes mentionnés dans un texte, sans doublon. */
export function mentionnes(
  texte: string,
  mentions: Mentions
): { perimetres: string[]; groupes: string[] } {
  const perimetres = new Set<string>()
  const groupes = new Set<string>()
  for (const s of decouper(texte, mentions)) {
    if (s.type === 'perimetre') perimetres.add(s.cle)
    if (s.type === 'groupe') groupes.add(s.cle)
  }
  return { perimetres: [...perimetres], groupes: [...groupes] }
}

interface Noeud {
  type: string
  value?: string
  children?: Noeud[]
  data?: Record<string, unknown>
}

/**
 * Extension de remark : chaque mention connue d'un texte devient un élément
 * `span` marqué `data-mention`, que le rendu des fiches affiche en étiquette. Le
 * texte d'un lien et le code ne changent pas.
 */
export function remarkMentions(mentions: Mentions | undefined) {
  return () => (arbre: Noeud) => {
    if (mentions === undefined) return
    const parcourir = (noeud: Noeud) => {
      if (noeud.children === undefined) return
      if (noeud.type === 'link' || noeud.type === 'linkReference') return
      noeud.children = noeud.children.flatMap(enfant => {
        if (enfant.type !== 'text' || enfant.value === undefined) {
          parcourir(enfant)
          return [enfant]
        }
        const segments = decouper(enfant.value, mentions)
        if (segments.every(s => s.type === 'texte')) return [enfant]
        return segments.map<Noeud>(s =>
          s.type === 'texte'
            ? { type: 'text', value: s.valeur }
            : {
                type: 'mention',
                data: {
                  hName: 'span',
                  hProperties: { dataMention: `${s.type}:${s.cle}` },
                },
                children: [{ type: 'text', value: s.valeur }],
              }
        )
      })
    }
    parcourir(arbre)
  }
}
