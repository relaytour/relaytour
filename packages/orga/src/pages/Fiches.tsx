import {
  AppstoreOutlined,
  BookOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { plural, t } from '@lingui/core/macro'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Button, Empty, Input, Segmented, Skeleton, Space } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import DepotFiches from '../composants/DepotFiches'
import DocumentsActivite from '../composants/DocumentsActivite'
import EtiquettePerimetre from '../composants/EtiquettePerimetre'
import { Groupe } from '../composants/Panneau'
import { Puces } from '../composants/Puces'
import Titre from '../composants/Titre'
import type { ListeFichesQuery } from '../gql/graphql'
import { jourDeLInstant } from '../lib/erreurs'
import { DOSSIERS_LIES } from '../lib/espace-fichiers'
import { useGroupesReplies } from '../lib/groupes-replies'
import { LISTE_FICHES } from '../lib/fiches'
import { useOrganisation } from '../lib/organisation'
import { normaliser } from '../lib/recherche'
import { teinteLisible } from '../lib/theme'
import { useActivite } from '../lib/activite'
import { comparerTextes } from '../lib/langue'

type FicheListe = ListeFichesQuery['fiches'][number]
type Affichage = 'cartes' | 'liste'

/** « 3 fiches ». */
function nombreDeFiches(nombre: number): string {
  return t`${plural(nombre, { one: '# fiche', other: '# fiches' })}`
}

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
  const date = jourDeLInstant(fiche.modifieeLe)
  const auteur = fiche.modifieePar
  if (fiche.source === 'GIT' && !auteur) return t`Depuis le dépôt · ${date}`
  if (fiche.source === 'ESPACE_FICHIERS')
    return t`Depuis le fournisseur cloud · ${date}`
  return auteur
    ? t`Mise à jour le ${date} par ${auteur}`
    : t`Mise à jour le ${date}`
}

export default function Fiches() {
  const { t } = useLingui()
  const { lien, activite, gere, aModule } = useActivite()
  const navigate = useNavigate()
  const { theme } = useOrganisation()
  const replies = useGroupesReplies('fiches')
  // Le dépôt direct de fichiers est ouvert aux admins de l'activité (ADR 0049).
  const [depot, setDepot] = useState(false)
  const { data, loading } = useQuery(LISTE_FICHES)
  // Les documents de l'espace de fichiers (ADR 0038) : l'onglet n'apparaît que
  // si au moins un dossier lié est lisible.
  // Sans le module documents, ni la requête ni l'onglet (ADR 0052).
  const { data: documents } = useQuery(DOSSIERS_LIES, {
    variables: { activiteId: activite.id },
    skip: !aModule('DOCUMENTS'),
  })
  const dossiers = aModule('DOCUMENTS') ? (documents?.dossiersLies ?? []) : []
  const [parametres, setParametres] = useSearchParams()
  const vueDocuments =
    parametres.get('vue') === 'documents' && dossiers.length > 0
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
        nom: fiche.perimetre?.nom ?? t`Fiches communes`,
        slug: fiche.perimetre?.slug ?? null,
        couleur: fiche.perimetre?.couleur ?? null,
        fiches: [],
      }
      groupe.fiches.push(fiche)
      map.set(cle, groupe)
    }
    return [...map.values()].sort((a, b) =>
      a.slug === null ? -1 : b.slug === null ? 1 : comparerTextes(a.nom, b.nom)
    )
  }, [data, t])

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
        sousTitre={
          vueDocuments
            ? t`Vous lisez ici les documents que l’association range chez son fournisseur cloud. Relaytour n’en garde aucune copie.`
            : t`Les fiches méthode expliquent comment mener chaque étape de l’organisation.`
        }
        actions={
          !vueDocuments && (
            <Space wrap>
              {gere && (
                <Button
                  size="large"
                  icon={<UploadOutlined />}
                  onClick={() => setDepot(true)}
                >
                  <Trans>Déposer des fichiers</Trans>
                </Button>
              )}
              {data?.peutRedigerFichesCommunes && (
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={() => navigate(lien('/fiches/nouvelle'))}
                >
                  <Trans>Nouvelle fiche commune</Trans>
                </Button>
              )}
            </Space>
          )
        }
      >
        <Trans>Ressources</Trans>
      </Titre>
      {depot && (
        <DepotFiches
          fermer={() => setDepot(false)}
          perimetreInitial={
            perimetre === TOUTES || perimetre === COMMUNES ? null : perimetre
          }
        />
      )}

      {dossiers.length > 0 && (
        <Segmented
          aria-label={t`Contenu affiché`}
          style={{ marginBottom: 18 }}
          value={vueDocuments ? 'documents' : 'fiches'}
          onChange={valeur =>
            setParametres(valeur === 'documents' ? { vue: 'documents' } : {}, {
              replace: true,
            })
          }
          options={[
            { value: 'fiches', label: t`Fiches` },
            { value: 'documents', label: t`Documents` },
          ]}
        />
      )}

      {vueDocuments ? (
        <DocumentsActivite dossiers={dossiers} />
      ) : (
        <>
          <div className="rt-puces" style={{ marginBottom: 22, rowGap: 10 }}>
            <Input
              allowClear
              aria-label={t`Rechercher une fiche`}
              placeholder={t`Rechercher une fiche`}
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
                libelle={t`Périmètre des fiches`}
                valeur={perimetre}
                onChange={setPerimetre}
                options={[
                  { valeur: TOUTES, libelle: t`Toutes` },
                  ...tousGroupes.map(g => ({
                    valeur: g.cle,
                    libelle:
                      g.slug === null ? (
                        t`Communes`
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
                <Plural value={total} one="# fiche" other="# fiches" />
              </span>
              <Segmented<Affichage>
                aria-label={t`Affichage des fiches`}
                value={affichage}
                onChange={changerAffichage}
                options={[
                  {
                    value: 'cartes',
                    icon: <AppstoreOutlined />,
                    title: t`Cartes`,
                    label: <span className="rt-sr">{t`Cartes`}</span>,
                  },
                  {
                    value: 'liste',
                    icon: <UnorderedListOutlined />,
                    title: t`Liste condensée`,
                    label: <span className="rt-sr">{t`Liste condensée`}</span>,
                  },
                ]}
              />
            </span>
          </div>

          {loading && !data ? (
            <Skeleton active />
          ) : groupes.length === 0 ? (
            <div className="rt-verre rt-panneau">
              <Empty
                description={
                  recherche || perimetre !== TOUTES
                    ? t`Aucune fiche ne correspond.`
                    : t`Aucune fiche pour le moment.`
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
                  <Groupe
                    key={groupe.cle}
                    nom={groupe.nom}
                    replie={replies.estReplie(groupe.cle)}
                    onBasculer={() => replies.basculer(groupe.cle)}
                    titre={
                      groupe.slug ? (
                        <EtiquettePerimetre
                          nom={groupe.nom}
                          couleur={groupe.couleur}
                          lien={lien(`/perimetres/${groupe.slug}`)}
                          point
                        />
                      ) : (
                        <span className="rt-etiquette rt-etiquette-verre">
                          {groupe.nom}
                        </span>
                      )
                    }
                    compte={nombreDeFiches(groupe.fiches.length)}
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
                  </Groupe>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}
