import {
  AppstoreOutlined,
  BookOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Button, Empty, Input, Segmented, Skeleton } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import EtiquettePerimetre from '../composants/EtiquettePerimetre'
import { Section } from '../composants/Panneau'
import { Puces } from '../composants/Puces'
import Titre from '../composants/Titre'
import type { ListeFichesQuery } from '../gql/graphql'
import { dateCourte } from '../lib/erreurs'
import { LISTE_FICHES } from '../lib/fiches'
import { useOrganisation } from '../lib/organisation'
import { normaliser } from '../lib/recherche'
import { teinteLisible } from '../lib/theme'
import { useActivite } from '../lib/activite'

type FicheListe = ListeFichesQuery['fiches'][number]
type Affichage = 'cartes' | 'liste'

const COMMUNES = 'communes'
const TOUTES = 'toutes'
// Le choix d'affichage est une commodité propre au navigateur.
const CLE_AFFICHAGE = 'relaytour.fiches.affichage'

function affichageMemorise(): Affichage {
  try {
    return localStorage.getItem(CLE_AFFICHAGE) === 'liste' ? 'liste' : 'cartes'
  } catch {
    return 'cartes'
  }
}

function miseAJour(fiche: FicheListe): string {
  const date = dateCourte(fiche.modifieeLe)
  if (fiche.source === 'GIT' && !fiche.modifieePar)
    return `Depuis le dépôt · ${date}`
  return fiche.modifieePar
    ? `Mise à jour le ${date} par ${fiche.modifieePar}`
    : `Mise à jour le ${date}`
}

export default function Fiches() {
  const { lien } = useActivite()
  const navigate = useNavigate()
  const { theme } = useOrganisation()
  const { data, loading } = useQuery(LISTE_FICHES)
  const [recherche, setRecherche] = useState('')
  const [perimetre, setPerimetre] = useState<string>(TOUTES)
  const [affichage, setAffichage] = useState<Affichage>(affichageMemorise)

  const changerAffichage = (valeur: Affichage) => {
    setAffichage(valeur)
    try {
      localStorage.setItem(CLE_AFFICHAGE, valeur)
    } catch {
      // Le navigateur refuse le stockage : le choix vaut pour la visite.
    }
  }

  // Tous les groupes, communes d'abord, puis les périmètres par nom.
  const tousGroupes = useMemo(() => {
    const map = new Map<
      string,
      {
        cle: string
        nom: string
        slug: string | null
        couleur: string | null
        fiches: FicheListe[]
      }
    >()
    for (const fiche of data?.fiches ?? []) {
      const cle = fiche.perimetre?.id ?? COMMUNES
      const groupe = map.get(cle) ?? {
        cle,
        nom: fiche.perimetre?.nom ?? 'Fiches communes',
        slug: fiche.perimetre?.slug ?? null,
        couleur: fiche.perimetre?.couleur ?? null,
        fiches: [],
      }
      groupe.fiches.push(fiche)
      map.set(cle, groupe)
    }
    return [...map.values()].sort((a, b) =>
      a.slug === null
        ? -1
        : b.slug === null
          ? 1
          : a.nom.localeCompare(b.nom, 'fr')
    )
  }, [data])

  const groupes = useMemo(() => {
    const filtre = normaliser(recherche.trim())
    return tousGroupes
      .filter(g => perimetre === TOUTES || g.cle === perimetre)
      .map(g => ({
        ...g,
        fiches: filtre
          ? g.fiches.filter(f => normaliser(f.titre).includes(filtre))
          : g.fiches,
      }))
      .filter(g => g.fiches.length > 0)
  }, [tousGroupes, recherche, perimetre])

  const total = groupes.reduce((n, g) => n + g.fiches.length, 0)

  return (
    <>
      <Titre
        sousTitre="Les fiches méthode expliquent comment mener chaque étape de l’organisation."
        actions={
          data?.peutRedigerFichesCommunes && (
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={() => navigate(lien('/fiches/nouvelle'))}
            >
              Nouvelle fiche commune
            </Button>
          )
        }
      >
        Fiches
      </Titre>

      <div className="rt-puces" style={{ marginBottom: 22, rowGap: 10 }}>
        <Input
          allowClear
          aria-label="Rechercher une fiche"
          placeholder="Rechercher une fiche"
          prefix={
            <SearchOutlined
              aria-hidden
              style={{ color: 'var(--rt-encre-55)' }}
            />
          }
          style={{ maxWidth: 320, borderRadius: 999 }}
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
        />
        {tousGroupes.length > 1 && (
          <Puces
            libelle="Périmètre des fiches"
            valeur={perimetre}
            onChange={setPerimetre}
            options={[
              { valeur: TOUTES, libelle: 'Toutes' },
              ...tousGroupes.map(g => ({
                valeur: g.cle,
                libelle:
                  g.slug === null ? (
                    'Communes'
                  ) : (
                    <>
                      <span
                        className="rt-point"
                        style={{
                          background: g.couleur ?? 'var(--rt-primaire)',
                        }}
                        aria-hidden="true"
                      />
                      {g.nom}
                    </>
                  ),
              })),
            ]}
          />
        )}
        <span
          style={{
            marginInlineStart: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span className="rt-compte">
            {total} {total > 1 ? 'fiches' : 'fiche'}
          </span>
          <Segmented<Affichage>
            aria-label="Affichage des fiches"
            value={affichage}
            onChange={changerAffichage}
            options={[
              {
                value: 'cartes',
                icon: <AppstoreOutlined />,
                title: 'Cartes',
                label: <span className="rt-sr">Cartes</span>,
              },
              {
                value: 'liste',
                icon: <UnorderedListOutlined />,
                title: 'Liste condensée',
                label: <span className="rt-sr">Liste condensée</span>,
              },
            ]}
          />
        </span>
      </div>

      {loading ? (
        <Skeleton active />
      ) : groupes.length === 0 ? (
        <div className="rt-verre rt-panneau">
          <Empty
            description={
              recherche || perimetre !== TOUTES
                ? 'Aucune fiche ne correspond.'
                : 'Aucune fiche pour le moment.'
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {groupes.map(groupe => {
            const couleur = groupe.couleur ?? theme.couleurs.primaire
            const icone = {
              background:
                groupe.slug === null
                  ? 'var(--rt-encre-08)'
                  : `color-mix(in srgb, ${couleur} 13%, transparent)`,
              color:
                groupe.slug === null
                  ? 'var(--rt-encre)'
                  : teinteLisible(couleur, theme.couleurs.encre),
            }
            return (
              <Section
                key={groupe.cle}
                titre={
                  groupe.slug ? (
                    <EtiquettePerimetre
                      nom={groupe.nom}
                      couleur={groupe.couleur}
                      lien={lien(`/perimetres/${groupe.slug}`)}
                      point
                    />
                  ) : (
                    groupe.nom
                  )
                }
                compte={`${groupe.fiches.length} ${groupe.fiches.length > 1 ? 'fiches' : 'fiche'}`}
              >
                <ul
                  className={
                    affichage === 'cartes'
                      ? 'rt-grille-fiches'
                      : 'rt-verre rt-liste-condensee'
                  }
                >
                  {groupe.fiches.map(fiche => (
                    <li key={fiche.id}>
                      <Link
                        to={lien(`/fiches/${fiche.slug}`)}
                        className={`rt-carte-fiche${affichage === 'cartes' ? ' rt-verre' : ''}`}
                      >
                        <span className="rt-carte-fiche-titre">
                          <span className="rt-icone-fiche" style={icone}>
                            <BookOutlined aria-hidden />
                          </span>
                          {fiche.titre}
                        </span>
                        <span className="rt-date">{miseAJour(fiche)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )
          })}
        </div>
      )}
    </>
  )
}
