import { useQuery } from '@apollo/client/react'
import { useMemo } from 'react'

import { useActivite } from './activite'
import type { Mentions, PerimetreMentionnable } from './mentions'
import { PERIMETRES } from './requetes'

/**
 * Les périmètres non archivés de l'activité et ses groupes, que les mentions d'une
 * fiche désignent (ADR 0039). Vide tant que la liste n'est pas lue.
 */
export function useMentions(): Mentions {
  const { activite, libelleGroupe } = useActivite()
  const { data } = useQuery(PERIMETRES)
  return useMemo(() => {
    const perimetres = new Map<string, PerimetreMentionnable>()
    for (const p of data?.perimetres ?? []) {
      if (p.archive) continue
      perimetres.set(p.slug, {
        id: p.id,
        slug: p.slug,
        nom: p.nom,
        couleur: p.couleur ?? null,
        groupe: p.groupe,
      })
    }
    const groupes = new Map(
      activite.groupes.map(g => [
        g.cle,
        {
          libelle: libelleGroupe(g.cle, true),
          perimetres: [...perimetres.values()].filter(p => p.groupe === g.cle),
        },
      ])
    )
    return { perimetres, groupes }
  }, [data, activite.groupes, libelleGroupe])
}
