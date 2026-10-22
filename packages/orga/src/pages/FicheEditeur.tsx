import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Col,
  Drawer,
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
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import EditeurMarkdown, {
  type ModeEditeur,
} from '../composants/EditeurMarkdown'
import ChampConcerneAussi from '../composants/ChampConcerneAussi'
import DocumentsReserves from '../composants/DocumentsReserves'
import GuideMarkdown from '../composants/GuideMarkdown'
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
  REGLER_CONCERNE,
  slugDepuisTitre,
} from '../lib/fiches'
import {
  aProposer,
  AUCUNE,
  largeDiffusion,
  memeListe,
  perimetresConcernes,
  reunir,
  type Concerne,
} from '../lib/concerne'
import { useMentions } from '../lib/useMentions'
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

// Le mode de l'éditeur est une commodité propre au navigateur. Le mode visuel
// est le mode par défaut.
const CLE_MODE = 'relaytour.fiches.editeur'

function modeMemorise(): ModeEditeur {
  try {
    return localStorage.getItem(CLE_MODE) === 'markdown' ? 'markdown' : 'visuel'
  } catch {
    return 'visuel'
  }
}

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
    perimetre?: { id: string } | null
    concerneGroupes: string[]
    connexions: { par: string; perimetre: { id: string } }[]
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
  const { message, modal } = App.useApp()
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
  // Vrai dès que cet écran a écrit un brouillon.
  const aEcrit = useRef(false)
  useEffect(() => {
    // Sans modification, rien ne s'écrit : un brouillon proposé à l'ouverture reste
    // intact. Dès que la personne modifie le texte, sa saisie se garde, même sans
    // réponse à la proposition : l'ancien brouillon reste offert par l'avis tant que
    // l'écran est ouvert. Une saisie annulée jusqu'au texte de départ efface le
    // brouillon que cet écran a écrit.
    if (!modifie) {
      if (aEcrit.current) {
        effacerBrouillon(cle)
        aEcrit.current = false
      }
      return
    }
    const minuteur = window.setTimeout(() => {
      if (termine.current) return
      aEcrit.current = true
      ecrireBrouillon(cle, {
        titre,
        contenu,
        versionDeDepart,
        enregistreLe: new Date().toISOString(),
      })
    }, 400)
    return () => window.clearTimeout(minuteur)
  }, [cle, titre, contenu, versionDeDepart, modifie])
  const [mode, setMode] = useState<ModeEditeur>(modeMemorise)
  const changerMode = (valeur: ModeEditeur) => {
    setMode(valeur)
    try {
      localStorage.setItem(CLE_MODE, valeur)
    } catch {
      // Le navigateur refuse le stockage : le choix vaut pour la visite.
    }
  }
  // Un texte remplacé hors de l'éditeur (brouillon repris, sections du gabarit)
  // remonte l'éditeur visuel, qui part du texte reçu.
  const [cleVisuel, setCleVisuel] = useState(0)
  // La liste « Concerne aussi » d'une fiche de périmètre (ADR 0039). Elle ne passe
  // pas par le brouillon : elle s'enregistre avec la fiche.
  const mentions = useMentions()
  const perimetreDeLaFiche = fiche?.perimetre?.id ?? perimetre?.id ?? null
  const [listeDeDepart] = useState<Concerne>(() =>
    fiche === null
      ? AUCUNE
      : {
          perimetres: fiche.connexions
            .filter(c => c.par === 'LISTE')
            .map(c => c.perimetre.id),
          groupes: fiche.concerneGroupes,
        }
  )
  const [concerne, setConcerne] = useState<Concerne>(listeDeDepart)
  // Une proposition déclinée ne revient pas pendant la rédaction.
  const declinees = useRef(new Set<string>())
  const [regler] = useMutation(REGLER_CONCERNE, {
    refetchQueries: ['Fiche', 'FichesDuPerimetre'],
  })
  // Le guide s'ouvre dans un tiroir : la saisie reste à l'écran.
  const [aide, setAide] = useState(false)
  const [slugTouche, setSlugTouche] = useState(false)
  const [creer, creationEnCours] = useMutation(CREER_FICHE, {
    refetchQueries: ['ListeFiches', 'PagePerimetre'],
  })
  const [modifier, modificationEnCours] = useMutation(MODIFIER_FICHE)

  /**
   * Avant l'enregistrement : propose d'ajouter les mentions du texte à la liste,
   * puis demande une confirmation pour une large diffusion. Rend la liste à
   * enregistrer, ou null quand la personne revient à l'éditeur.
   */
  const preparerLaListe = async (): Promise<Concerne | null> => {
    if (perimetreDeLaFiche === null) return concerne
    let liste = concerne
    const proposition = aProposer(contenu, mentions, liste, perimetreDeLaFiche)
    const nouvelles = {
      perimetres: proposition.perimetres.filter(
        id => !declinees.current.has(`p:${id}`)
      ),
      groupes: proposition.groupes.filter(
        g => !declinees.current.has(`g:${g}`)
      ),
    }
    const noms = [
      ...nouvelles.groupes.map(g => mentions.groupes.get(g)?.libelle ?? g),
      ...nouvelles.perimetres.map(
        id =>
          [...mentions.perimetres.values()].find(p => p.id === id)?.nom ?? id
      ),
    ]
    if (noms.length > 0) {
      const ajouter = await modal.confirm({
        title: 'Ajouter les mentions à « Concerne aussi » ?',
        content: `Le texte mentionne ${noms.join(', ')}. Une fois ces périmètres ajoutés, leurs référentes et référents liront la fiche sans pouvoir la modifier.`,
        okText: 'Ajouter',
        cancelText: 'Ne pas ajouter',
      })
      if (ajouter) {
        liste = reunir(liste, nouvelles)
        setConcerne(liste)
      } else {
        for (const id of nouvelles.perimetres) declinees.current.add(`p:${id}`)
        for (const g of nouvelles.groupes) declinees.current.add(`g:${g}`)
      }
    }
    const concernes = perimetresConcernes(
      liste,
      mentions,
      perimetreDeLaFiche
    ).size
    const total = mentions.perimetres.size
    if (!memeListe(liste, listeDeDepart) && largeDiffusion(concernes, total)) {
      const confirme = await modal.confirm({
        title: `Cette fiche apparaîtra dans ${concernes} périmètres sur ${total}.`,
        content:
          'Leurs référentes et référents la liront dans leurs fiches connexes, sans pouvoir la modifier. Si elle concerne toute l’activité, une fiche commune convient mieux.',
        okText: 'Confirmer la liste',
        cancelText: 'Revenir à l’éditeur',
      })
      if (!confirme) return null
    }
    return liste
  }

  /** Enregistre la liste quand elle a changé. Une erreur laisse la fiche enregistrée. */
  const enregistrerLaListe = async (ficheId: string, liste: Concerne) => {
    if (perimetreDeLaFiche === null || memeListe(liste, listeDeDepart)) return
    try {
      await regler({
        variables: {
          ficheId,
          perimetreIds: liste.perimetres,
          groupes: liste.groupes,
        },
      })
    } catch (e) {
      message.error(
        `La fiche est enregistrée, mais pas sa liste « Concerne aussi » : ${messageErreur(e)}`
      )
    }
  }

  const enregistrer = async (v: Valeurs, depuis = versionDeDepart) => {
    const liste = await preparerLaListe()
    if (liste === null) return
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
        if (r.data?.creerFiche.id)
          await enregistrerLaListe(r.data.creerFiche.id, liste)
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
        await enregistrerLaListe(fiche.id, liste)
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
    setCleVisuel(c => c + 1)
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

        <div className="rt-editeur-fiche-tete">
          <Typography.Text strong id="contenu-fiche">
            Contenu
          </Typography.Text>
          <Segmented
            value={mode}
            onChange={changerMode}
            aria-labelledby="contenu-fiche"
            options={[
              { value: 'visuel', label: 'Visuel' },
              { value: 'markdown', label: 'Markdown' },
            ]}
          />
        </div>
        <EditeurMarkdown
          valeur={contenu}
          onChange={setContenu}
          onAide={() => setAide(true)}
          libelle="Contenu de la fiche"
          mode={mode}
          cleVisuel={cleVisuel}
          mentions={mentions}
        />

        {perimetreDeLaFiche !== null && (
          <Form.Item
            label="Concerne aussi"
            style={{ marginTop: 16, marginBottom: 0 }}
            extra="La fiche se lit, sans s’y modifier, dans ces périmètres. Un groupe concerne aussi les périmètres qui le rejoindront. Une mention @périmètre ou @groupe:clé du texte se propose à l’enregistrement."
          >
            <ChampConcerneAussi
              valeur={concerne}
              onChange={setConcerne}
              mentions={mentions}
              perimetreDeLaFiche={perimetreDeLaFiche}
            />
          </Form.Item>
        )}
        {perimetreDeLaFiche !== null && fiche && (
          <DocumentsReserves
            slug={fiche.slug}
            concerne={concerne}
            mentions={mentions}
            perimetreDeLaFiche={perimetreDeLaFiche}
          />
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
              onClick={() => {
                setContenu(c => `${c.trimEnd()}\n\n${GABARIT_FICHE}`)
                setCleVisuel(c => c + 1)
              }}
            >
              Ajouter les sections du gabarit
            </Button>
          )}
        </Space>
      </Form>

      <Drawer
        title="Aide Markdown"
        open={aide}
        onClose={() => setAide(false)}
        size={ecrans.md ? 560 : '100%'}
        // Sur téléphone, le tiroir occupe l'écran : il ne propose pas d'onglet.
        extra={
          ecrans.md ? (
            <Link to={lien('/aide/markdown')} target="_blank">
              Ouvrir dans un onglet
            </Link>
          ) : undefined
        }
      >
        <GuideMarkdown compact />
      </Drawer>
    </>
  )
}
