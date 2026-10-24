import { CloudOutlined, FolderOutlined, TeamOutlined } from '@ant-design/icons'
import { Empty } from 'antd'
import { useMemo, useState } from 'react'

import type { DossiersLiesQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import EtiquettePerimetre from './EtiquettePerimetre'
import ExplorateurDossier from './ExplorateurDossier'
import { Section } from './Panneau'
import { langueActive } from '../lib/langue'

type Dossier = DossiersLiesQuery['dossiersLies'][number]
type PerimetreLu = Dossier['lecteursLus']['perimetres'][number]

/** Une section de la vue : toute l'activité, un groupe ou un périmètre. */
interface SectionDossiers {
  cle: string
  ordre: number
  tri: string
  groupe: string | null
  perimetre: PerimetreLu | null
  dossiers: Dossier[]
}

/**
 * Les dossiers du fournisseur cloud liés à l'activité (ADR 0038, 0043). La vue
 * range un dossier sous chacun des lecteurs par lesquels la personne le lit :
 * toute l'activité d'abord, puis ses groupes, puis ses périmètres.
 */
export default function DocumentsActivite({
  dossiers,
}: {
  dossiers: Dossier[]
}) {
  const { lien, libelleGroupe } = useActivite()
  const [ouvert, setOuvert] = useState<string | null>(null)

  const groupes = useMemo(() => {
    const map = new Map<string, SectionDossiers>()
    const ranger = (section: Omit<SectionDossiers, 'dossiers'>, d: Dossier) => {
      const existante = map.get(section.cle) ?? { ...section, dossiers: [] }
      if (!existante.dossiers.includes(d)) existante.dossiers.push(d)
      map.set(section.cle, existante)
    }
    for (const d of dossiers) {
      const lus = d.lecteursLus
      if (lus.touteActivite) {
        ranger({ cle: '', ordre: 0, tri: '', groupe: null, perimetre: null }, d)
      }
      for (const cle of lus.groupes) {
        ranger(
          {
            cle: `g:${cle}`,
            ordre: 1,
            tri: libelleGroupe(cle, true),
            groupe: cle,
            perimetre: null,
          },
          d
        )
      }
      for (const p of lus.perimetres) {
        ranger(
          {
            cle: `p:${p.id}`,
            ordre: 2,
            tri: p.nom,
            groupe: null,
            perimetre: p,
          },
          d
        )
      }
    }
    return [...map.values()].sort(
      (a, b) => a.ordre - b.ordre || a.tri.localeCompare(b.tri, langueActive())
    )
  }, [dossiers, libelleGroupe])

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
            ) : groupe.groupe !== null ? (
              <span className="rt-etiquette rt-mention-groupe">
                <TeamOutlined aria-hidden />{' '}
                {libelleGroupe(groupe.groupe, true)}
              </span>
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
                    {d.disponible
                      ? 'Fournisseur cloud'
                      : 'Fournisseur déconnecté'}
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
