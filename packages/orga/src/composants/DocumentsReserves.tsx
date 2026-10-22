import { useQuery } from '@apollo/client/react'
import { Alert } from 'antd'

import { perimetresConcernes, type Concerne } from '../lib/concerne'
import { RESSOURCES_FICHE } from '../lib/espace-fichiers'
import type { Mentions } from '../lib/mentions'

/**
 * Dans l'éditeur, l'avertissement des documents liés que des périmètres de la
 * liste « Concerne aussi » n'ouvriront pas (ADR 0043). Le calcul suit la liste en
 * cours de saisie : un dossier lié sert un périmètre qu'il nomme, ou dont il nomme
 * le groupe. La fiche montre ensuite le détail et les gestes d'un admin.
 */
export default function DocumentsReserves({
  slug,
  concerne,
  mentions,
  perimetreDeLaFiche,
}: {
  slug: string
  concerne: Concerne
  mentions: Mentions
  perimetreDeLaFiche: string
}) {
  const { data } = useQuery(RESSOURCES_FICHE, { variables: { slug } })
  const concernes = perimetresConcernes(concerne, mentions, perimetreDeLaFiche)
  if (concernes.size === 0) return null
  const parId = new Map([...mentions.perimetres.values()].map(p => [p.id, p]))
  const reserves = (data?.fiche?.ressources ?? []).flatMap(r => {
    if (r.ouverteAuxLecteurs || r.dossierLie.touteActivite) return []
    const listes = new Set(r.dossierLie.perimetres.map(p => p.id))
    const manquants = [...concernes]
      .map(id => parId.get(id))
      .filter(
        p =>
          p !== undefined &&
          !listes.has(p.id) &&
          !r.dossierLie.groupes.includes(p.groupe)
      )
      .map(p => p!.nom)
    return manquants.length === 0 ? [] : [{ nom: r.nom, manquants }]
  })
  if (reserves.length === 0) return null
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginTop: 12 }}
      title={
        reserves.length > 1
          ? `${reserves.length} documents liés ne s’ouvriront pas pour tous les périmètres concernés.`
          : 'Un document lié ne s’ouvrira pas pour tous les périmètres concernés.'
      }
      description={
        <>
          <ul className="rt-liste-simple">
            {reserves.map(r => (
              <li key={r.nom}>
                «&nbsp;{r.nom}&nbsp;» : {r.manquants.join(', ')}
              </li>
            ))}
          </ul>
          Un admin de l’organisation peut étendre le dossier lié, ou ouvrir le
          document aux lecteurs de la fiche, depuis la fiche.
        </>
      }
    />
  )
}
