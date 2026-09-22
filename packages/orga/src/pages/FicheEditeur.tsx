import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Grid,
  Input,
  Result,
  Row,
  Segmented,
  Skeleton,
  Space,
  Typography,
} from 'antd'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import Markdown from '../composants/Markdown'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import { messageErreur } from '../lib/erreurs'
import {
  CREER_FICHE,
  FICHE,
  GABARIT_FICHE,
  MODIFIER_FICHE,
  slugDepuisTitre,
} from '../lib/fiches'
import { useActivite } from '../lib/activite'

const PERIMETRE_CIBLE = graphql(`
  query PerimetreCibleFiche($slug: String!) {
    perimetre(slug: $slug) {
      id
      nom
      peutRedigerFiches
    }
  }
`)

const DROIT_COMMUNES = graphql(`
  query DroitFichesCommunes {
    peutRedigerFichesCommunes
  }
`)

interface Valeurs {
  titre: string
  slug: string
  resume?: string
}

/** Création (/fiches/nouvelle?perimetre=slug) ou modification (/fiches/:slug/modifier). */
export default function FicheEditeur() {
  const { slug } = useParams()
  const [parametres] = useSearchParams()
  const creation = slug === undefined
  const slugPerimetre = parametres.get('perimetre')

  const existante = useQuery(FICHE, {
    variables: { slug: slug ?? '' },
    skip: creation,
  })
  const perimetre = useQuery(PERIMETRE_CIBLE, {
    variables: { slug: slugPerimetre ?? '' },
    skip: !creation || slugPerimetre === null,
  })
  const communes = useQuery(DROIT_COMMUNES, {
    skip: !creation || slugPerimetre !== null,
  })

  const fiche = existante.data?.fiche
  const chargement = existante.loading || perimetre.loading || communes.loading
  const autorise = creation
    ? slugPerimetre !== null
      ? perimetre.data?.perimetre?.peutRedigerFiches
      : communes.data?.peutRedigerFichesCommunes
    : fiche?.peutModifier
  if (chargement) return <Skeleton active />
  if (!autorise)
    return (
      <Result
        status="403"
        title="Vous n’avez pas le droit de rédiger cette fiche."
      />
    )

  return (
    <Formulaire
      key={fiche?.id ?? 'nouvelle'}
      fiche={fiche ?? null}
      perimetre={
        creation && slugPerimetre !== null
          ? (perimetre.data?.perimetre ?? null)
          : null
      }
    />
  )
}

function Formulaire({
  fiche,
  perimetre,
}: {
  fiche: { id: string; slug: string; titre: string; contenu: string } | null
  perimetre: { id: string; nom: string } | null
}) {
  const creation = fiche === null
  const navigate = useNavigate()
  const { lien } = useActivite()
  const { message } = App.useApp()
  const ecrans = Grid.useBreakpoint()
  const [form] = Form.useForm<Valeurs>()
  const [contenu, setContenu] = useState(fiche?.contenu ?? GABARIT_FICHE)
  const [vue, setVue] = useState<'ecrire' | 'apercu'>('ecrire')
  const [slugTouche, setSlugTouche] = useState(false)
  const [creer, creationEnCours] = useMutation(CREER_FICHE, {
    refetchQueries: ['ListeFiches', 'PagePerimetre'],
  })
  const [modifier, modificationEnCours] = useMutation(MODIFIER_FICHE)

  const enregistrer = async (v: Valeurs) => {
    try {
      if (creation) {
        const r = await creer({
          variables: {
            slug: v.slug,
            titre: v.titre,
            contenu,
            perimetreId: perimetre?.id ?? null,
          },
        })
        message.success('Fiche créée.')
        navigate(lien(`/fiches/${r.data?.creerFiche.slug ?? v.slug}`))
      } else if (fiche) {
        await modifier({
          variables: {
            id: fiche.id,
            titre: v.titre,
            contenu,
            resume: v.resume || null,
          },
        })
        message.success('Fiche enregistrée.')
        navigate(lien(`/fiches/${fiche.slug}`))
      }
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const editeur = (
    <Input.TextArea
      value={contenu}
      onChange={e => setContenu(e.target.value)}
      autoSize={{ minRows: 18 }}
      style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14 }}
      aria-label="Contenu de la fiche en Markdown"
    />
  )
  const apercu = (
    <Card size="small" style={{ minHeight: 400 }}>
      <Markdown contenu={contenu} />
    </Card>
  )

  return (
    <>
      <Titre
        sousTitre={
          creation
            ? perimetre !== null
              ? `Nouvelle fiche du périmètre ${perimetre.nom}`
              : 'Nouvelle fiche commune à tous les périmètres'
            : 'Chaque enregistrement crée une nouvelle version. Les admins consultent l’historique.'
        }
      >
        {creation ? 'Nouvelle fiche' : 'Modifier la fiche'}
      </Titre>

      <Form
        form={form}
        layout="vertical"
        onFinish={v => void enregistrer(v)}
        requiredMark={false}
        initialValues={
          fiche ? { titre: fiche.titre, slug: fiche.slug } : undefined
        }
      >
        <Row gutter={16}>
          <Col xs={24} md={14}>
            <Form.Item
              label="Titre"
              name="titre"
              rules={[{ required: true, message: 'Saisissez un titre.' }]}
            >
              <Input
                onChange={e => {
                  if (creation && !slugTouche)
                    form.setFieldValue('slug', slugDepuisTitre(e.target.value))
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item
              label="Identifiant"
              name="slug"
              extra={
                creation
                  ? 'Il apparaît dans l’adresse de la fiche et ne change plus.'
                  : undefined
              }
              rules={[
                { required: true, message: 'Saisissez un identifiant.' },
                {
                  pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
                  message: 'Minuscules, chiffres et tirets seulement.',
                },
              ]}
            >
              <Input
                disabled={!creation}
                onChange={() => setSlugTouche(true)}
              />
            </Form.Item>
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Écrivez les contacts sous forme de rôles, sans adresse ni numéro personnels."
        />

        {ecrans.lg ? (
          <Row gutter={16}>
            <Col span={12}>
              <Typography.Text strong>Markdown</Typography.Text>
              {editeur}
            </Col>
            <Col span={12}>
              <Typography.Text strong>Aperçu</Typography.Text>
              {apercu}
            </Col>
          </Row>
        ) : (
          <>
            <Segmented
              style={{ marginBottom: 12 }}
              value={vue}
              onChange={setVue}
              options={[
                { value: 'ecrire', label: 'Écrire' },
                { value: 'apercu', label: 'Aperçu' },
              ]}
            />
            {vue === 'ecrire' ? editeur : apercu}
          </>
        )}

        {!creation && (
          <Form.Item
            label="Résumé de la modification (facultatif)"
            name="resume"
            style={{ marginTop: 16 }}
          >
            <Input
              maxLength={200}
              placeholder="Ajout des horaires d’ouverture de la piscine"
            />
          </Form.Item>
        )}

        <Space wrap style={{ marginTop: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={creationEnCours.loading || modificationEnCours.loading}
          >
            Enregistrer
          </Button>
          <Button onClick={() => navigate(-1)}>Annuler</Button>
          {!creation && (
            <Button
              type="link"
              onClick={() =>
                setContenu(c => `${c.trimEnd()}\n\n${GABARIT_FICHE}`)
              }
            >
              Ajouter les sections du gabarit
            </Button>
          )}
        </Space>
      </Form>
    </>
  )
}
