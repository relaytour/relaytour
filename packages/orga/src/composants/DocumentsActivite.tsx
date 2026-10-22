import { CloudOutlined, FolderOutlined } from '@ant-design/icons'
import { Empty } from 'antd'
import { useMemo, useState } from 'react'

import type { DossiersLiesQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import EtiquettePerimetre from './EtiquettePerimetre'
import ExplorateurDossier from './ExplorateurDossier'
import { Section } from './Panneau'

type Dossier = DossiersLiesQuery['dossiersLies'][number]

/**
 * Les dossiers de l'espace de fichiers liés à l'activité (ADR 0038) : ceux de
 * toute l'activité d'abord, puis ceux de chaque périmètre que la personne lit.
 */
export default function DocumentsActivite({
  dossiers,
}: {
  dossiers: Dossier[]
}) {
  const { lien } = useActivite()
  const [ouvert, setOuvert] = useState<string | null>(null)

  const groupes = useMemo(() => {
    const map = new Map<
      string,
      { cle: string; perimetre: Dossier['perimetre']; dossiers: Dossier[] }
    >()
    for (const d of dossiers) {
      const cle = d.perimetre?.id ?? ''
      const groupe = map.get(cle) ?? {
        cle,
        perimetre: d.perimetre,
        dossiers: [],
      }
      groupe.dossiers.push(d)
      map.set(cle, groupe)
    }
    return [...map.values()].sort((a, b) =>
      a.perimetre === null || a.perimetre === undefined
        ? -1
        : b.perimetre === null || b.perimetre === undefined
          ? 1
          : a.perimetre.nom.localeCompare(b.perimetre.nom, 'fr')
    )
  }, [dossiers])

  const dossierOuvert = dossiers.find(d => d.id === ouvert)
  if (dossierOuvert !== undefined) {
    return (
      <ExplorateurDossier
        key={dossierOuvert.id}
        dossier={dossierOuvert}
        onRetour={() => setOuvert(null)}
      />
    )
  }

  if (dossiers.length === 0) {
    return (
      <div className="rt-verre rt-panneau">
        <Empty description="Aucun dossier du fournisseur cloud n’est lié à vos périmètres." />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {groupes.map(groupe => (
        <Section
          key={groupe.cle}
          titre={
            groupe.perimetre ? (
              <EtiquettePerimetre
                nom={groupe.perimetre.nom}
                couleur={groupe.perimetre.couleur}
                lien={lien(`/perimetres/${groupe.perimetre.slug}`)}
                point
              />
            ) : (
              'Toute l’activité'
            )
          }
          compte={`${groupe.dossiers.length} ${groupe.dossiers.length > 1 ? 'dossiers' : 'dossier'}`}
        >
          <ul className="rt-grille-fiches">
            {groupe.dossiers.map(d => (
              <li key={d.id}>
                <button
                  type="button"
                  className="rt-carte-fiche rt-verre"
                  onClick={() => setOuvert(d.id)}
                >
                  <span className="rt-carte-fiche-titre">
                    <span
                      className="rt-icone-fiche"
                      style={{ background: 'var(--rt-encre-08)' }}
                    >
                      <FolderOutlined aria-hidden />
                    </span>
                    {d.nom}
                  </span>
                  <span className="rt-date">
                    <CloudOutlined aria-hidden />{' '}
                    {d.disponible ? 'Fournisseur cloud' : 'Fournisseur déconnecté'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  )
}
