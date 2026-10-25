import { FolderOutlined, ImportOutlined } from '@ant-design/icons'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, App, Button, Form, Modal, Result, Space, Tag } from 'antd'
import { useState } from 'react'

import type { SimulerImportFichesQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import {
  IMPORTER_FICHES,
  PARCOURIR,
  PERIMETRES_A_LIER,
  SIMULER_IMPORT,
} from '../lib/espace-fichiers'
import { normaliser } from '../lib/recherche'
import { Panneau } from './Panneau'
import ParcoursEspace, { type PositionChoisie } from './ParcoursEspace'

// Import initial des fiches depuis l'espace de fichiers (ADR 0038). L'admin de
// l'organisation désigne le dossier qui range les fiches ; Relaytour y propose un
// sous-dossier par périmètre, d'après son nom, et « communes » pour les fiches
// communes. Chaque proposition se change. L'import se simule avant d'écrire.

type Rapport = SimulerImportFichesQuery['simulerImportFiches']

interface Source {
  emplacement: string
  chemin: string[]
}

const COMMUNES = ''
const AUCUNE: PositionChoisie = { emplacement: null, chemin: [] }

/** Le rapport d'un import, simulé ou réel, rubrique par rubrique. */
function RapportImport({ rapport, fait }: { rapport: Rapport; fait: boolean }) {
  const { t } = useLingui()
  const liste = (titre: string, elements: string[], couleur?: string) =>
    elements.length > 0 && (
      <div style={{ marginBottom: 12 }}>
        <strong>{titre}</strong>
        <div className="rt-puces" style={{ marginTop: 6, rowGap: 6 }}>
          {elements.map(e => (
            <Tag key={e} color={couleur}>
              {e}
            </Tag>
          ))}
        </div>
      </div>
    )
  const lignes = (
    titre: string,
    elements: { cle: string; raison: string }[],
    type: 'warning' | 'info'
  ) =>
    elements.length > 0 && (
      <Alert
        type={type}
        showIcon
        style={{ marginBottom: 12 }}
        message={titre}
        description={
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {elements.map(e => (
              <li key={e.cle}>
                {e.cle} : {e.raison}
              </li>
            ))}
          </ul>
        }
      />
    )
  return (
    <>
      {liste(
        fait ? t`Fiches créées` : t`Fiches à créer`,
        rapport.creees,
        'green'
      )}
      {liste(
        fait ? t`Nouvelles versions` : t`Fiches à mettre à jour`,
        rapport.nouvellesVersions,
        'blue'
      )}
      {liste(t`Fiches inchangées`, rapport.inchangees)}
      {lignes(
        t`Ces fiches restent telles quelles dans Relaytour.`,
        rapport.conflits.map(c => ({ cle: c.fiche, raison: c.raison })),
        'warning'
      )}
      {lignes(
        t`Ces fichiers contiennent une coordonnée personnelle : ils ne s’importent pas.`,
        rapport.refusees.map(f => ({ cle: f.fichier, raison: f.raison })),
        'warning'
      )}
      {lignes(
        t`Ces documents Word sont convertis en Markdown.`,
        rapport.converties.map(f => ({ cle: f.fichier, raison: f.raison })),
        'info'
      )}
      {lignes(
        t`Ces fichiers ne s’importent pas.`,
        rapport.nonImportes.map(f => ({ cle: f.fichier, raison: f.raison })),
        'info'
      )}
      {rapport.incomplet && (
        <Alert
          type="warning"
          showIcon
          message={t`Un dossier source compte trop d’éléments pour les lire tous. Rangez ses fiches dans plusieurs dossiers.`}
        />
      )}
    </>
  )
}

/** L'assistant d'import, dans une fenêtre. */
function AssistantImport({
  ouvert,
  onFermer,
}: {
  ouvert: boolean
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { activite } = useActivite()
  const { message } = App.useApp()
  const client = useApolloClient()
  const [etape, setEtape] = useState<'racine' | 'sources' | 'rapport'>('racine')
  const [racine, setRacine] = useState<PositionChoisie>(AUCUNE)
  const [sources, setSources] = useState<Map<string, Source | null>>(new Map())
  const [changement, setChangement] = useState<string | null>(null)
  const [choixSource, setChoixSource] = useState<PositionChoisie>(AUCUNE)
  const [rapport, setRapport] = useState<Rapport | null>(null)
  const [fait, setFait] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const perimetres = useQuery(PERIMETRES_A_LIER, {
    variables: { activiteId: activite.id },
    skip: !ouvert,
  })
  const [importer] = useMutation(IMPORTER_FICHES, {
    refetchQueries: ['ListeFiches', 'EspaceFichiers'],
  })

  const lignes = [
    { cle: COMMUNES, nom: t`Fiches communes` },
    ...(perimetres.data?.perimetres ?? []).map(p => ({
      cle: p.id,
      nom: p.nom,
    })),
  ]

  const fermer = () => {
    setEtape('racine')
    setRacine(AUCUNE)
    setSources(new Map())
    setRapport(null)
    setFait(false)
    onFermer()
  }

  // Un sous-dossier du dossier des fiches par périmètre, d'après son nom ou son
  // identifiant, et « communes » pour les fiches communes.
  const proposer = async () => {
    if (racine.emplacement === null) return
    setEnCours(true)
    try {
      const { data } = await client.query({
        query: PARCOURIR,
        variables: { emplacement: racine.emplacement, chemin: racine.chemin },
        fetchPolicy: 'network-only',
      })
      const sousDossiers = data?.parcourirEspaceFichiers.elements ?? []
      const trouver = (...noms: string[]) =>
        sousDossiers.find(d =>
          noms.some(n => normaliser(d.nom) === normaliser(n))
        )
      const proposees = new Map<string, Source | null>()
      for (const p of perimetres.data?.perimetres ?? []) {
        const d = trouver(p.nom, p.slug)
        proposees.set(
          p.id,
          d === undefined
            ? null
            : {
                emplacement: racine.emplacement,
                chemin: [...racine.chemin, d.nom],
              }
        )
      }
      // eslint-disable-next-line lingui/no-unlocalized-strings -- Nom de dossier cherché dans l'espace de fichiers de l'association, pas un texte affiché.
      const communes = trouver('communes', 'fiches communes')
      proposees.set(
        COMMUNES,
        communes === undefined
          ? null
          : {
              emplacement: racine.emplacement,
              chemin: [...racine.chemin, communes.nom],
            }
      )
      setSources(proposees)
      setEtape('sources')
    } catch (e) {
      message.error(messageErreur(e))
    } finally {
      setEnCours(false)
    }
  }

  const variables = () => ({
    activiteId: activite.id,
    sources: [...sources.entries()]
      .filter((e): e is [string, Source] => e[1] !== null)
      .map(([cle, source]) => ({
        perimetreId: cle === COMMUNES ? null : cle,
        emplacement: source.emplacement,
        chemin: source.chemin,
      })),
  })

  const simuler = async () => {
    setEnCours(true)
    try {
      const { data } = await client.query({
        query: SIMULER_IMPORT,
        variables: variables(),
        fetchPolicy: 'network-only',
      })
      setRapport(data?.simulerImportFiches ?? null)
      setFait(false)
      setEtape('rapport')
    } catch (e) {
      message.error(messageErreur(e))
    } finally {
      setEnCours(false)
    }
  }

  const lancer = async () => {
    setEnCours(true)
    try {
      const r = await importer({ variables: variables() })
      setRapport(r.data?.importerFichesEspace ?? null)
      setFait(true)
      message.success(t`Les fiches sont importées.`)
    } catch (e) {
      message.error(messageErreur(e))
    } finally {
      setEnCours(false)
    }
  }

  const aImporter =
    rapport !== null &&
    rapport.creees.length + rapport.nouvellesVersions.length > 0
  const nomActivite = activite.nom
  const nbSources = [...sources.values()].filter(s => s !== null).length

  const pied =
    etape === 'racine' ? (
      <Button
        type="primary"
        disabled={racine.emplacement === null}
        loading={enCours}
        onClick={() => void proposer()}
      >
        <Trans>Suivant</Trans>
      </Button>
    ) : etape === 'sources' ? (
      <Space>
        <Button onClick={() => setEtape('racine')}>
          <Trans>Retour</Trans>
        </Button>
        <Button
          type="primary"
          disabled={nbSources === 0}
          loading={enCours}
          onClick={() => void simuler()}
        >
          <Trans>Simuler l’import</Trans>
        </Button>
      </Space>
    ) : fait ? (
      <Button type="primary" onClick={fermer}>
        <Trans>Fermer</Trans>
      </Button>
    ) : (
      <Space>
        <Button onClick={() => setEtape('sources')}>
          <Trans>Revenir aux dossiers</Trans>
        </Button>
        <Button
          type="primary"
          disabled={!aImporter}
          loading={enCours}
          onClick={() => void lancer()}
        >
          <Trans>Importer</Trans>
        </Button>
      </Space>
    )

  return (
    <Modal
      open={ouvert}
      onCancel={fermer}
      title={t`Importer des fiches dans « ${nomActivite} »`}
      width={720}
      footer={pied}
      destroyOnHidden
    >
      {etape === 'racine' && (
        <Form layout="vertical" component="div">
          <p className="rt-texte-secondaire">
            <Trans>
              Ouvrez le dossier qui range les fiches de l’activité. Relaytour y
              cherche un sous-dossier par périmètre, à son nom, et un
              sous-dossier « communes » pour les fiches communes.
            </Trans>
          </p>
          <ParcoursEspace
            actif={ouvert}
            valeur={racine}
            onChange={setRacine}
            aide={chemin => {
              const dernierDossier = chemin[chemin.length - 1]
              return dernierDossier === undefined
                ? t`La racine de la bibliothèque sera le dossier des fiches.`
                : t`Le dossier « ${dernierDossier} » sera le dossier des fiches.`
            }}
          />
        </Form>
      )}

      {etape === 'sources' && (
        <>
          <p className="rt-texte-secondaire">
            <Trans>
              Chaque périmètre reçoit les fiches Markdown, texte et Word de son
              dossier. Les sous-dossiers ne sont pas lus.
            </Trans>
          </p>
          <ul className="rt-explorateur">
            {lignes.map(l => {
              const source = sources.get(l.cle) ?? null
              return (
                <li key={l.cle} className="rt-explorateur-ligne">
                  <FolderOutlined
                    aria-hidden
                    className="rt-explorateur-icone"
                  />
                  <span className="rt-explorateur-nom">
                    {l.nom}
                    <span className="rt-explorateur-detail">
                      {source === null
                        ? t`Aucun dossier`
                        : source.chemin.join(' / ') || t`Racine`}
                    </span>
                  </span>
                  <Button
                    size="small"
                    onClick={() => {
                      setChoixSource(
                        source === null
                          ? racine
                          : {
                              emplacement: source.emplacement,
                              chemin: source.chemin,
                            }
                      )
                      setChangement(l.cle)
                    }}
                  >
                    <Trans>Changer</Trans>
                  </Button>
                  {source !== null && (
                    <Button
                      size="small"
                      type="text"
                      onClick={() =>
                        setSources(new Map(sources).set(l.cle, null))
                      }
                    >
                      <Trans>Aucun</Trans>
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {etape === 'rapport' && rapport !== null && (
        <>
          {fait ? (
            <Result
              status="success"
              title={t`Import terminé`}
              subTitle={t`L’export suivant écrit ces fiches en Markdown dans le dossier d’export.`}
            />
          ) : (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t`Simulation : rien n’a encore changé.`}
              description={t`La conversion d’un document Word perd une partie de sa mise en forme. Les fiches s’écrivent ensuite en Markdown, et l’export vers le fournisseur cloud aussi.`}
            />
          )}
          <RapportImport rapport={rapport} fait={fait} />
        </>
      )}

      <Modal
        open={changement !== null}
        onCancel={() => setChangement(null)}
        title={t`Choisir le dossier source`}
        okText={t`Prendre ce dossier`}
        okButtonProps={{ disabled: choixSource.emplacement === null }}
        onOk={() => {
          if (changement === null || choixSource.emplacement === null) return
          setSources(
            new Map(sources).set(changement, {
              emplacement: choixSource.emplacement,
              chemin: choixSource.chemin,
            })
          )
          setChangement(null)
        }}
        destroyOnHidden
        width={640}
      >
        <Form layout="vertical" component="div">
          <ParcoursEspace
            actif={changement !== null}
            valeur={choixSource}
            onChange={setChoixSource}
            aide={chemin => {
              const dossierSource = chemin[chemin.length - 1] ?? t`la racine`
              return t`Les fiches de « ${dossierSource} » seront importées.`
            }}
          />
        </Form>
      </Modal>
    </Modal>
  )
}

/** Le panneau de l'écran d'admin qui ouvre l'assistant d'import. */
export default function ImportFiches({ actif }: { actif: boolean }) {
  const { t } = useLingui()
  const [ouvert, setOuvert] = useState(false)
  return (
    <Panneau titre={t`Importer des fiches`} icone={<ImportOutlined />}>
      <p className="rt-texte-secondaire">
        <Trans>
          Reprenez les fiches que l’association range déjà chez son fournisseur
          cloud : des fichiers Markdown, texte ou Word. L’import se simule
          d’abord. Une fiche modifiée dans Relaytour n’est jamais remplacée.
        </Trans>
      </p>
      <Button
        icon={<ImportOutlined />}
        disabled={!actif}
        onClick={() => setOuvert(true)}
      >
        <Trans>Importer des fiches</Trans>
      </Button>
      <AssistantImport ouvert={ouvert} onFermer={() => setOuvert(false)} />
    </Panneau>
  )
}
