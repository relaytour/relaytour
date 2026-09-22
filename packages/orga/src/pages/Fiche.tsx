import { EditOutlined, HistoryOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Drawer,
  Empty,
  Popconfirm,
  Result,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import EtiquettePerimetre from '../composants/EtiquettePerimetre'
import Markdown from '../composants/Markdown'
import { DeuxColonnes, Panneau } from '../composants/Panneau'
import Titre from '../composants/Titre'
import { dateCourte, messageErreur } from '../lib/erreurs'
import {
  FICHE,
  RESTAURER_VERSION,
  TACHES_FICHE,
  VERSIONS_FICHE,
} from '../lib/fiches'
import { EDITION_COURANTE } from '../lib/requetes'

function dateHeure(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Fiche() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { data, loading, error } = useQuery(FICHE, { variables: { slug } })
  const { data: courante } = useQuery(EDITION_COURANTE)
  const editionId = courante?.editionCourante?.id
  const liees = useQuery(TACHES_FICHE, {
    variables: { slug, editionId: editionId ?? '' },
    skip: editionId === undefined || !data?.fiche,
  })
  const [historique, setHistorique] = useState(false)
  const [apercu, setApercu] = useState<string | null>(null)
  const versions = useQuery(VERSIONS_FICHE, {
    variables: { slug },
    skip: !historique || !data?.moi?.estAdmin,
  })
  const [restaurer, restauration] = useMutation(RESTAURER_VERSION, {
    refetchQueries: ['VersionsFiche', 'Fiche'],
  })

  if (error)
    return <Result status="403" title="Vous n’avez pas accès à cette fiche." />
  if (loading || !data) return <Skeleton active />
  const fiche = data.fiche
  if (!fiche)
    return <Result status="404" title="Cette fiche est introuvable." />

  const versionAffichee = versions.data?.fiche?.versions.find(
    v => v.id === apercu
  )

  const taches = liees.data?.fiche?.taches ?? []

  return (
    <>
      <Titre
        avant={
          <nav aria-label="Fil d’Ariane" className="rt-ariane">
            <Link to="/fiches">Fiches</Link>
            <span aria-hidden="true">/</span>
            {fiche.perimetre ? (
              <EtiquettePerimetre
                nom={fiche.perimetre.nom}
                couleur={fiche.perimetre.couleur}
                lien={`/perimetres/${fiche.perimetre.slug}`}
                point
              />
            ) : (
              <span>Fiches communes</span>
            )}
          </nav>
        }
        sousTitre={
          <>
            Mise à jour le {dateHeure(fiche.modifieeLe)}
            {fiche.modifieePar
              ? ` par ${fiche.modifieePar}.`
              : ' depuis le dépôt.'}
          </>
        }
        actions={
          <>
            {fiche.archive && <Tag>Archivée</Tag>}
            {data.moi?.estAdmin && (
              <Button
                icon={<HistoryOutlined />}
                onClick={() => setHistorique(true)}
              >
                Historique
              </Button>
            )}
            {fiche.peutModifier && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/fiches/${fiche.slug}/modifier`)}
              >
                Modifier
              </Button>
            )}
          </>
        }
      >
        {fiche.titre}
      </Titre>

      <DeuxColonnes
        cote={
          <>
            <Panneau titre="À propos">
              <dl className="rt-description">
                <dt>Périmètre</dt>
                <dd>{fiche.perimetre?.nom ?? 'Fiche commune'}</dd>
                <dt>Source</dt>
                <dd>{fiche.source === 'GIT' ? 'Dépôt' : 'Application'}</dd>
                <dt>Identifiant</dt>
                <dd
                  className="rt-mono"
                  style={{ fontWeight: 400, fontSize: 12.5 }}
                >
                  {fiche.slug}
                </dd>
                {fiche.nombreVersions !== null &&
                  fiche.nombreVersions !== undefined && (
                    <>
                      <dt>Versions</dt>
                      <dd>{fiche.nombreVersions}</dd>
                    </>
                  )}
              </dl>
            </Panneau>
            {editionId && (
              <Panneau
                titre="Tâches liées"
                extra={
                  <span className="rt-compte">
                    {courante?.editionCourante?.annee}
                  </span>
                }
              >
                {liees.loading ? (
                  <Skeleton active paragraph={{ rows: 2 }} title={false} />
                ) : taches.length === 0 ? (
                  <p className="rt-texte-secondaire">
                    Aucune tâche de l’édition en cours ne renvoie à cette fiche.
                  </p>
                ) : (
                  <ul className="rt-liste-liens">
                    {taches.map(t => (
                      <li key={t.id}>
                        <Link
                          className="rt-ligne-lien"
                          style={{ fontSize: 13.5 }}
                          to={`/perimetres/${t.perimetre.slug}?edition=${editionId}`}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              minWidth: 0,
                            }}
                          >
                            <span
                              className="rt-point"
                              style={{
                                background:
                                  t.perimetre.couleur ?? 'var(--rt-primaire)',
                              }}
                            />
                            {t.titre}
                          </span>
                          {t.echeance && (
                            <span
                              className={`rt-date${t.enRetard ? ' rt-date-retard' : ''}`}
                              style={{ fontWeight: 400, whiteSpace: 'nowrap' }}
                            >
                              {dateCourte(t.echeance)}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panneau>
            )}
          </>
        }
      >
        {fiche.peutModifier && fiche.donneesPersonnelles.length > 0 && (
          <Alert
            type="warning"
            showIcon
            title="Cette fiche contient une adresse ou un numéro personnel."
            description="Elle ne pourra pas être reversée dans le dépôt Git. Remplacez les coordonnées par un rôle (par exemple « service des sports de la Ville »)."
          />
        )}

        <article
          className="rt-verre"
          style={{
            borderRadius: 'var(--rt-rayon-panneau)',
            padding: '30px 36px 34px',
          }}
        >
          <Markdown contenu={fiche.contenu} />
        </article>
      </DeuxColonnes>

      <Drawer
        open={historique}
        onClose={() => {
          setHistorique(false)
          setApercu(null)
        }}
        title="Historique de la fiche"
        size={560}
      >
        {versions.loading ? (
          <Skeleton active />
        ) : versionAffichee ? (
          <>
            <Button
              style={{ marginBottom: 16 }}
              onClick={() => setApercu(null)}
            >
              Retour à la liste
            </Button>
            <Typography.Title level={4}>
              {versionAffichee.titre}
            </Typography.Title>
            <Markdown contenu={versionAffichee.contenu} />
          </>
        ) : (versions.data?.fiche?.versions ?? []).length === 0 ? (
          <Empty />
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {(versions.data?.fiche?.versions ?? []).map(version => {
              const courante =
                version.id === versions.data?.fiche?.versionCouranteId
              return (
                <li
                  key={version.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: '1px solid var(--rt-encre-08)',
                  }}
                >
                  <div style={{ flex: '1 1 240px' }}>
                    <Space size={6} wrap>
                      <Typography.Text strong>
                        {dateHeure(version.creeLe)}
                      </Typography.Text>
                      {courante && <Tag color="blue">Actuelle</Tag>}
                      <Tag>
                        {version.source === 'GIT' ? 'Dépôt' : 'Application'}
                      </Tag>
                    </Space>
                    <div style={{ opacity: 0.7, fontSize: 13 }}>
                      {version.auteur?.nom ?? 'Import'}
                      {version.resume ? ` · ${version.resume}` : ''}
                    </div>
                  </div>
                  <Space>
                    <Button size="small" onClick={() => setApercu(version.id)}>
                      Voir
                    </Button>
                    {!courante && (
                      <Popconfirm
                        title="Restaurer cette version ?"
                        description="Une nouvelle version est créée : l’historique reste complet."
                        okText="Restaurer"
                        cancelText="Annuler"
                        onConfirm={async () => {
                          try {
                            await restaurer({
                              variables: { versionId: version.id },
                            })
                            message.success('Version restaurée.')
                          } catch (e) {
                            message.error(messageErreur(e))
                          }
                        }}
                      >
                        <Button size="small" loading={restauration.loading}>
                          Restaurer
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                </li>
              )
            })}
          </ol>
        )}
      </Drawer>
    </>
  )
}
