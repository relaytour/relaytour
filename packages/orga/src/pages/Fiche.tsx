import { EditOutlined, HistoryOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Card,
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

import Markdown from '../composants/Markdown'
import Titre from '../composants/Titre'
import { messageErreur } from '../lib/erreurs'
import { FICHE, RESTAURER_VERSION, VERSIONS_FICHE } from '../lib/fiches'

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

  return (
    <>
      <div
        style={{
          borderInlineStart: `8px solid ${fiche.perimetre?.couleur ?? '#FC685F'}`,
          paddingInlineStart: 16,
        }}
      >
        <Titre
          sousTitre={
            <>
              {fiche.perimetre ? (
                <Link to={`/perimetres/${fiche.perimetre.slug}`}>
                  {fiche.perimetre.nom}
                </Link>
              ) : (
                'Fiche commune'
              )}
              {' · '}Mise à jour le {dateHeure(fiche.modifieeLe)}
              {fiche.modifieePar
                ? ` par ${fiche.modifieePar}`
                : ' depuis le dépôt'}
            </>
          }
        >
          {fiche.titre}
        </Titre>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        {fiche.peutModifier && (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/fiches/${fiche.slug}/modifier`)}
          >
            Modifier
          </Button>
        )}
        {data.moi?.estAdmin && (
          <Button
            icon={<HistoryOutlined />}
            onClick={() => setHistorique(true)}
          >
            Historique
          </Button>
        )}
        {fiche.archive && <Tag>Archivée</Tag>}
      </Space>

      {fiche.peutModifier && fiche.donneesPersonnelles.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Cette fiche contient une adresse ou un numéro personnel."
          description="Elle ne pourra pas être reversée dans le dépôt Git. Remplacez les coordonnées par un rôle (par exemple « service des sports de la Ville »)."
        />
      )}

      <Card>
        <Markdown contenu={fiche.contenu} />
      </Card>

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
                    borderBottom: '1px solid rgba(3,37,101,.08)',
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
