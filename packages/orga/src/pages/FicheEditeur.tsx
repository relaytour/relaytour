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
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import Markdown from '../composants/Markdown'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import {
  cleBrouillon,
  ecrireBrouillon,
  effacerBrouillon,
  lireBrouillon,
} from '../lib/brouillon'
import { annonceConflitFiche, lireConflit, type Conflit } from '../lib/conflit'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import {
  CREER_FICHE,
  FICHE,
  GABARIT_FICHE,
  MODIFIER_FICHE,
  slugDepuisTitre,
} from '../lib/fiches'
import { useActivite } from '../lib/activite'
import { useSansRafraichissement } from '../lib/rafraichissement'
import { organisationChoisie } from '../lib/selection'

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
  // Une relecture ne démonte pas le formulaire : seul un premier chargement affiche
  // le squelette.
  const chargement = [existante, perimetre, communes].some(
    requete => requete.loading && !requete.data
  )
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
      cible={slugPerimetre ?? 'commune'}
    />
  )
}

type ConflitDeFiche = Extract<Conflit, { nature: 'contenu' }>

function Formulaire({
  fiche,
  perimetre,
  cible,
}: {
  fiche: {
    id: string
    slug: string
    titre: string
    contenu: string
    versionCouranteId?: string | null
  } | null
  perimetre: { id: string; nom: string } | null
  /** Pour une fiche nouvelle : le slug de son périmètre, ou `commune`. */
  cible: string
}) {
  const creation = fiche === null
  // L'éditeur garde la version de la fiche qu'il a chargée : la relecture
  // périodique ne la remplace pas sous la saisie.
  useSansRafraichissement('Fiche')
  const navigate = useNavigate()
  const { lien, activite } = useActivite()
  const { message } = App.useApp()
  const ecrans = Grid.useBreakpoint()
  const [form] = Form.useForm<Valeurs>()
  const depart = fiche?.contenu ?? GABARIT_FICHE
  const [contenu, setContenu] = useState(depart)
  // La version lue avant la rédaction : le serveur refuse d'enregistrer par-dessus
  // une version écrite depuis. Elle ne suit pas les relectures de la fiche.
  const [versionDeDepart, setVersionDeDepart] = useState(
    fiche?.versionCouranteId ?? null
  )
  const [conflit, setConflit] = useState<ConflitDeFiche | null>(null)

  // Le texte en cours se garde dans le navigateur : une page rechargée ou une
  // session terminée ne le perdent pas. Un brouillon trouvé à l'ouverture se
  // propose, sans remplacer le texte de la fiche d'office.
  const cle = cleBrouillon({
    organisation: organisationChoisie(),
    activite: activite.slug,
    fiche: fiche?.id ?? `nouvelle.${cible}`,
  })
  const [brouillon, setBrouillon] = useState(() => {
    const lu = lireBrouillon(cle)
    return lu !== null &&
      (lu.contenu !== depart || lu.titre !== (fiche?.titre ?? ''))
      ? lu
      : null
  })
  const titre = Form.useWatch('titre', form) ?? fiche?.titre ?? ''
  const modifie = contenu !== depart || titre !== (fiche?.titre ?? '')
  // La saisie est enregistrée ou abandonnée : une écriture différée du brouillon ne
  // le recrée pas avant que l'écran ne soit quitté.
  const termine = useRef(false)
  const oublierLeBrouillon = () => {
    termine.current = true
    effacerBrouillon(cle)
  }
  useEffect(() => {
    // Sans modification, rien ne s'écrit : un brouillon proposé à l'ouverture reste
    // intact. Dès que la personne modifie le texte, sa saisie se garde, même sans
    // réponse à la proposition : l'ancien brouillon reste offert par l'avis tant que
    // l'écran est ouvert.
    if (!modifie) return
    const minuteur = window.setTimeout(() => {
      if (termine.current) return
      ecrireBrouillon(cle, {
        titre,
        contenu,
        versionDeDepart,
        enregistreLe: new Date().toISOString(),
      })
    }, 400)
    return () => window.clearTimeout(minuteur)
  }, [cle, titre, contenu, versionDeDepart, modifie])
  const [vue, setVue] = useState<'ecrire' | 'apercu'>('ecrire')
  const [slugTouche, setSlugTouche] = useState(false)
  const [creer, creationEnCours] = useMutation(CREER_FICHE, {
    refetchQueries: ['ListeFiches', 'PagePerimetre'],
  })
  const [modifier, modificationEnCours] = useMutation(MODIFIER_FICHE)

  const enregistrer = async (v: Valeurs, depuis = versionDeDepart) => {
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
        oublierLeBrouillon()
        message.success('Fiche créée.')
        navigate(lien(`/fiches/${r.data?.creerFiche.slug ?? v.slug}`))
      } else if (fiche) {
        await modifier({
          variables: {
            id: fiche.id,
            titre: v.titre,
            contenu,
            resume: v.resume || null,
            versionDeDepart: depuis,
          },
        })
        oublierLeBrouillon()
        message.success('Fiche enregistrée.')
        navigate(lien(`/fiches/${fiche.slug}`))
      }
    } catch (e) {
      // Une autre version existe : l'écran garde le texte et annonce le conflit.
      const lu = lireConflit(e)
      if (lu?.nature === 'contenu') setConflit(lu)
      else message.error(messageErreur(e))
    }
  }

  const reprendreLeBrouillon = () => {
    if (brouillon === null) return
    setContenu(brouillon.contenu)
    form.setFieldValue('titre', brouillon.titre)
    // Le brouillon garde sa version de départ : un conflit se détecte encore si la
    // fiche a changé depuis sa rédaction.
    setVersionDeDepart(brouillon.versionDeDepart)
    setBrouillon(null)
  }

  const ecraser = () => {
    if (conflit === null) return
    const actuelle = String(conflit.versionCourante)
    setVersionDeDepart(actuelle)
    setConflit(null)
    void enregistrer(form.getFieldsValue(), actuelle)
  }

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(contenu)
      message.success('Votre texte est copié.')
    } catch {
      message.error(
        'La copie a échoué. Sélectionnez le texte, puis copiez-le vous-même.'
      )
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

        {brouillon !== null && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={`Un brouillon du ${jourDeLInstant(brouillon.enregistreLe)} n’a pas été enregistré.`}
            description="Il est gardé dans ce navigateur. Reprenez-le pour continuer votre rédaction, ou supprimez-le pour repartir de la fiche. Si vous modifiez la fiche sans le reprendre, votre nouvelle saisie le remplace."
            action={
              <Space wrap>
                <Button onClick={reprendreLeBrouillon}>
                  Reprendre le brouillon
                </Button>
                <Button
                  onClick={() => {
                    // Une saisie déjà reprise sur la fiche garde son brouillon.
                    if (!modifie) effacerBrouillon(cle)
                    setBrouillon(null)
                  }}
                >
                  Supprimer le brouillon
                </Button>
              </Space>
            }
          />
        )}

        {conflit !== null && fiche !== null && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={annonceConflitFiche(conflit)}
            description="Votre texte reste à l’écran et n’est pas enregistré. Consultez la version actuelle avant de choisir."
            action={
              <Space wrap>
                <Button
                  href={lien(`/fiches/${fiche.slug}`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Voir la version actuelle
                </Button>
                <Button onClick={() => void copier()}>Copier mon texte</Button>
                <Button
                  danger
                  loading={modificationEnCours.loading}
                  onClick={ecraser}
                >
                  Écraser avec mon texte
                </Button>
              </Space>
            }
          />
        )}

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
              maxLength={191}
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
          <Button
            onClick={() => {
              // Annuler abandonne la saisie : son brouillon s'efface avec elle.
              oublierLeBrouillon()
              navigate(-1)
            }}
          >
            Annuler
          </Button>
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
