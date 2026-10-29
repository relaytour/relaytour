import { DownloadOutlined } from '@ant-design/icons'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  POLICES_DISPONIBLES,
  themeParDefaut,
  type CouleursTheme,
} from '@relaytour/tokens'
import {
  Alert,
  App,
  Button,
  Col,
  Form,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
} from 'antd'
import { useEffect, useState } from 'react'

import ChampCouleur from '../../composants/ChampCouleur'
import ChampImage from '../../composants/ChampImage'
import DepotContenu from '../../composants/DepotContenu'
import ReprendreMonAdresse from '../../composants/ReprendreMonAdresse'
import { Panneau } from '../../composants/Panneau'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import { jourDeLInstant, messageErreur } from '../../lib/erreurs'
import {
  LANGUE_SOURCE,
  LANGUES_PROPOSEES,
  NOMS_DES_LANGUES,
} from '../../lib/langue'
import { ORGANISATION } from '../../lib/organisation'
import { ACTIVITES } from '../../lib/requetes'

// Identité de l'organisation (ADR 0009) : les admins la modifient sans passer
// par l'hébergeur. Le slug, le statut et les limites restent à l'administration
// de l'installation. La page offre aussi l'export du contenu en archive.

const IDENTITE = graphql(`
  query IdentiteOrganisation {
    identiteOrganisation {
      slug
      nom
      sigle
      contactRecrutement
      contactSupport
      pageEquipe
      langue
      domainesCourrielAutorises
      adressesRoleAutorisees
      expediteurRecoitReponses
      logoPng
      logoSvg
      favicon
      iconeApplication
      theme
      contenuModifieLe
      contenuSynchroniseLe
    }
  }
`)

const MODIFIER = graphql(`
  mutation ModifierIdentiteOrganisation(
    $nom: String!
    $sigle: String
    $contactRecrutement: String
    $contactSupport: String
    $pageEquipe: String
    $langue: String
    $domainesCourrielAutorises: [String!]!
    $adressesRoleAutorisees: [String!]!
    $logoPng: String
    $logoSvg: String
    $favicon: String
    $iconeApplication: String
    $theme: JSONObject
  ) {
    modifierIdentiteOrganisation(
      nom: $nom
      sigle: $sigle
      contactRecrutement: $contactRecrutement
      contactSupport: $contactSupport
      pageEquipe: $pageEquipe
      langue: $langue
      domainesCourrielAutorises: $domainesCourrielAutorises
      adressesRoleAutorisees: $adressesRoleAutorisees
      logoPng: $logoPng
      logoSvg: $logoSvg
      favicon: $favicon
      iconeApplication: $iconeApplication
      theme: $theme
    ) {
      nom
    }
  }
`)

const EXPORT = graphql(`
  query ExportContenu {
    exportContenu {
      nomFichier
      donnees
    }
  }
`)

/** Couleurs que la page propose de modifier ; les autres gardent leur valeur déclarée. */
const COULEURS: { cle: keyof CouleursTheme; libelle: MessageDescriptor }[] = [
  {
    cle: 'primaire',
    libelle: msg({ message: 'Primaire', comment: 'Couleur du thème' }),
  },
  {
    cle: 'accent',
    libelle: msg({ message: 'Accent', comment: 'Couleur du thème' }),
  },
  { cle: 'encre', libelle: msg`Encre (texte)` },
  { cle: 'sol1', libelle: msg`Sol, haut` },
  { cle: 'sol2', libelle: msg`Sol, milieu` },
  { cle: 'sol3', libelle: msg`Sol, bas` },
]

type ThemeDeclare = {
  couleurs?: Record<string, string>
  fond?: {
    halo1?: { couleur?: string }
    halo2?: { couleur?: string }
    [cle: string]: unknown
  }
  polices?: { texte?: string; titre?: string; mono?: string }
  [cle: string]: unknown
}

interface Valeurs {
  nom: string
  sigle?: string
  contactRecrutement?: string
  contactSupport?: string
  pageEquipe?: string
  langue?: string
  domainesCourrielAutorises: string[]
  adressesRoleAutorisees: string[]
  logoPng: string | null
  logoSvg: string | null
  favicon: string | null
  iconeApplication: string | null
  couleurs: Partial<Record<keyof CouleursTheme, string | null>>
  halo1: string | null
  halo2: string | null
  policeTexte?: string
  policeTitre?: string
}

/** Retire les valeurs vides d'un objet ; undefined s'il ne reste rien. */
function sansVides<T extends Record<string, unknown>>(
  objet: T
): Partial<T> | undefined {
  const plein = Object.fromEntries(
    Object.entries(objet).filter(
      ([, v]) => v !== null && v !== undefined && v !== ''
    )
  ) as Partial<T>
  return Object.keys(plein).length === 0 ? undefined : plein
}

/** Le thème déclaré, avec les valeurs du formulaire ; les autres clés sont gardées. */
function themeDepuisFormulaire(
  declare: ThemeDeclare,
  v: Valeurs
): ThemeDeclare | null {
  const couleurs = sansVides({
    ...declare.couleurs,
    ...Object.fromEntries(COULEURS.map(({ cle }) => [cle, v.couleurs[cle]])),
  })
  const halo = (
    actuel: { couleur?: string } | undefined,
    couleur: string | null
  ) => sansVides({ ...actuel, couleur })
  const fond = sansVides({
    ...declare.fond,
    halo1: halo(declare.fond?.halo1, v.halo1),
    halo2: halo(declare.fond?.halo2, v.halo2),
  })
  const polices = sansVides({
    ...declare.polices,
    texte: v.policeTexte,
    titre: v.policeTitre,
  })
  return (sansVides({ ...declare, couleurs, fond, polices }) ??
    null) as ThemeDeclare | null
}

export default function Organisation() {
  const { t } = useLingui()
  const { message } = App.useApp()
  const apollo = useApolloClient()
  const { data, loading } = useQuery(IDENTITE)
  const [form] = Form.useForm<Valeurs>()
  const [erreur, setErreur] = useState<string | null>(null)
  const [exportEnCours, setExportEnCours] = useState(false)
  // Un domaine de rôle ajouté peut faire apparaître « Reprendre mon adresse ».
  const [modifier, modification] = useMutation(MODIFIER, {
    refetchQueries: [IDENTITE, ORGANISATION, ACTIVITES, 'MonAdresseDeRole'],
  })
  const identite = data?.identiteOrganisation
  const declare = (identite?.theme ?? {}) as ThemeDeclare

  useEffect(() => {
    if (!identite) return
    const theme = (identite.theme ?? {}) as ThemeDeclare
    form.setFieldsValue({
      nom: identite.nom,
      sigle: identite.sigle ?? '',
      contactRecrutement: identite.contactRecrutement ?? '',
      contactSupport: identite.contactSupport ?? '',
      pageEquipe: identite.pageEquipe ?? '',
      langue: identite.langue ?? LANGUE_SOURCE,
      domainesCourrielAutorises: identite.domainesCourrielAutorises,
      adressesRoleAutorisees: identite.adressesRoleAutorisees,
      logoPng: identite.logoPng ?? null,
      logoSvg: identite.logoSvg ?? null,
      favicon: identite.favicon ?? null,
      iconeApplication: identite.iconeApplication ?? null,
      couleurs: Object.fromEntries(
        COULEURS.map(({ cle }) => [cle, theme.couleurs?.[cle] ?? null])
      ),
      halo1: theme.fond?.halo1?.couleur ?? null,
      halo2: theme.fond?.halo2?.couleur ?? null,
      policeTexte: theme.polices?.texte,
      policeTitre: theme.polices?.titre,
    })
  }, [identite, form])

  const enregistrer = async (v: Valeurs) => {
    setErreur(null)
    try {
      await modifier({
        variables: {
          nom: v.nom,
          sigle: v.sigle || null,
          contactRecrutement: v.contactRecrutement || null,
          contactSupport: v.contactSupport || null,
          pageEquipe: v.pageEquipe || null,
          // Sans choix possible, la langue déclarée ne change pas (ADR 0047).
          langue: LANGUES_PROPOSEES.length > 1 ? v.langue : undefined,
          domainesCourrielAutorises: v.domainesCourrielAutorises,
          adressesRoleAutorisees: v.adressesRoleAutorisees,
          logoPng: v.logoPng,
          logoSvg: v.logoSvg,
          favicon: v.favicon,
          iconeApplication: v.iconeApplication,
          theme: themeDepuisFormulaire(declare, v),
        },
      })
      message.success(t`Identité enregistrée.`)
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  const telecharger = async () => {
    setExportEnCours(true)
    try {
      const { data: resultat } = await apollo.query({
        query: EXPORT,
        fetchPolicy: 'no-cache',
      })
      if (!resultat) throw new Error(t`L’export a échoué.`)
      const { nomFichier, donnees } = resultat.exportContenu
      const octets = Uint8Array.from(atob(donnees), c => c.charCodeAt(0))
      const lien = document.createElement('a')
      lien.href = URL.createObjectURL(
        new Blob([octets], { type: 'application/zip' })
      )
      lien.download = nomFichier
      lien.click()
      URL.revokeObjectURL(lien.href)
    } catch (e) {
      void message.error(messageErreur(e))
    } finally {
      setExportEnCours(false)
    }
  }

  const aExporter =
    identite?.contenuModifieLe != null &&
    (identite.contenuSynchroniseLe == null ||
      identite.contenuModifieLe > identite.contenuSynchroniseLe)

  const identifiant = identite?.slug
  const dateModification = identite?.contenuModifieLe
    ? jourDeLInstant(identite.contenuModifieLe)
    : ''
  const dateSynchronisation = identite?.contenuSynchroniseLe
    ? jourDeLInstant(identite.contenuSynchroniseLe)
    : ''

  if (loading && !data) return <Skeleton active />

  return (
    <>
      <Titre
        sousTitre={t`Le nom, les contacts, le logo et le thème de l’organisation. Chaque activité peut surcharger les contacts, le logo, les couleurs et le fond.`}
      >
        <Trans>Organisation</Trans>
      </Titre>

      {erreur && (
        <Alert
          type="error"
          showIcon
          title={erreur}
          style={{ marginBottom: 16 }}
        />
      )}

      {identite && !identite.contactRecrutement && (
        // Sans contact, les réponses aux mails de l'organisation arrivent à
        // l'expéditeur, ou se perdent s'il ne reçoit pas de courrier (ADR 0053).
        <Alert
          type="warning"
          showIcon
          title={t`Aucune adresse de contact n’est déclarée.`}
          description={
            identite.expediteurRecoitReponses
              ? t`Les réponses des membres aux mails arrivent à l’adresse d’envoi de l’installation. Déclarez une adresse de rôle dans le champ « Contact de l’organisation ».`
              : t`L’adresse d’envoi de l’installation ne reçoit pas de réponse : les mails invitent les membres à passer par l’espace organisateur. Déclarez une adresse de rôle dans le champ « Contact de l’organisation ».`
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={v => void enregistrer(v)}
        className="rt-colonne"
        style={{ gap: 24, marginBottom: 40 }}
      >
        <Panneau titre={t`Identité`}>
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item
                label={t`Nom`}
                name="nom"
                rules={[{ required: true, message: t`Saisissez un nom.` }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item label={t`Sigle (facultatif)`} name="sigle">
                <Input maxLength={20} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={t`Contact de l’organisation (facultatif)`}
                name="contactRecrutement"
                extra={
                  <>
                    {t`Une adresse de rôle, citée dans l’appel aux référentes et référents. Elle reçoit les réponses aux mails de l’organisation.`}{' '}
                    <ReprendreMonAdresse
                      onReprendre={adresse =>
                        form.setFieldsValue({ contactRecrutement: adresse })
                      }
                    />
                  </>
                }
              >
                <Input type="email" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={t`Adresse de support (facultatif)`}
                name="contactSupport"
                extra={t`Une adresse de rôle. Le bouton « Support » du menu du compte ouvre un mail à cette adresse.`}
              >
                <Input type="email" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={t`Page de l’équipe (facultatif)`}
                name="pageEquipe"
              >
                <Input type="url" placeholder="https://" />
              </Form.Item>
            </Col>
            {LANGUES_PROPOSEES.length > 1 && (
              <Col xs={24} md={12}>
                <Form.Item
                  label={t`Langue de l’organisation`}
                  name="langue"
                  extra={t`L’espace organisateur, les mails et les notifications s’affichent dans cette langue pour les membres qui n’en ont pas choisi.`}
                >
                  <Select
                    options={LANGUES_PROPOSEES.map(langue => ({
                      value: langue,
                      label: NOMS_DES_LANGUES[langue],
                    }))}
                  />
                </Form.Item>
              </Col>
            )}
          </Row>
          <p className="rt-texte-secondaire" style={{ margin: 0 }}>
            <Trans>
              L’identifiant « {identifiant} » ne change pas ici : il dépend de
              l’hébergement.
            </Trans>
          </p>
        </Panneau>

        <Panneau titre={t`Adresses de rôle`}>
          <p className="rt-texte-secondaire">
            <Trans>
              Une adresse de rôle appartient à l’organisation, pas à une
              personne. Relaytour l’accepte dans les fiches et dans l’export du
              contenu. Il signale toute autre adresse comme une donnée
              personnelle. Ces réglages ne limitent pas les invitations.
            </Trans>
          </p>
          <Form.Item
            label={t`Domaines des adresses de rôle`}
            name="domainesCourrielAutorises"
            extra={t`Toute adresse de ces domaines passe pour une adresse de rôle. Relaytour refuse les messageries grand public.`}
          >
            <Select
              mode="tags"
              tokenSeparators={[',', ' ']}
              placeholder="exemple.org"
              open={false}
            />
          </Form.Item>
          <Form.Item
            label={t`Adresses de rôle chez une messagerie grand public`}
            name="adressesRoleAutorisees"
            extra={t`Ajoutez ici une boîte partagée de l’organisation hébergée chez une messagerie grand public, adresse par adresse.`}
          >
            <Select
              mode="tags"
              tokenSeparators={[',', ' ']}
              placeholder="bureau.association@messagerie.example"
              open={false}
            />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            title={t`Une adresse de rôle passe pour institutionnelle.`}
            description={t`Relaytour la publie alors sans avertissement dans les fiches et dans l’export du contenu. N’ajoutez jamais l’adresse d’une personne : le RGPD protège une adresse nominative comme une donnée personnelle, même hébergée chez une messagerie grand public.`}
          />
        </Panneau>

        <Panneau titre={t`Logo et favicon`}>
          <p className="rt-texte-secondaire">
            <Trans>
              Le logo PNG s’affiche partout, y compris dans les mails. Le logo
              SVG, facultatif, le remplace à l’écran. Sans logo, l’espace
              affiche le pictogramme de Relaytour.
            </Trans>
          </p>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label={t`Logo PNG (512 Ko au plus)`} name="logoPng">
                <ChampImage format="PNG" libelle={t`Logo PNG`} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={t`Logo SVG (facultatif)`} name="logoSvg">
                <ChampImage format="SVG" libelle={t`Logo SVG`} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={t`Favicon PNG (facultatif)`} name="favicon">
                <ChampImage format="PNG" libelle={t`Favicon`} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label={t`Icône d’application (facultatif)`}
                name="iconeApplication"
                extra={t`PNG carré de 512 pixels de côté. Elle s’affiche sur l’écran d’accueil d’un téléphone qui installe l’application.`}
              >
                <ChampImage format="PNG" libelle={t`Icône d’application`} />
              </Form.Item>
            </Col>
          </Row>
        </Panneau>

        <Panneau titre={t`Thème`}>
          <p className="rt-texte-secondaire">
            <Trans>
              Une couleur vide reprend celle de Relaytour. Relaytour vérifie le
              contraste avant d’enregistrer.
            </Trans>
          </p>
          <Row gutter={16}>
            {COULEURS.map(({ cle, libelle }) => (
              <Col xs={24} sm={12} md={8} key={cle}>
                <Form.Item label={t(libelle)} name={['couleurs', cle]}>
                  <ChampCouleur heritee={themeParDefaut.couleurs[cle]} />
                </Form.Item>
              </Col>
            ))}
            <Col xs={24} sm={12} md={8}>
              <Form.Item label={t`Halo, premier`} name="halo1">
                <ChampCouleur heritee={themeParDefaut.fond.halo1.couleur} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label={t`Halo, second`} name="halo2">
                <ChampCouleur heritee={themeParDefaut.fond.halo2.couleur} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label={t`Police du texte`} name="policeTexte">
                <Select
                  allowClear
                  placeholder={t`Police de Relaytour`}
                  options={POLICES_DISPONIBLES.map(p => ({
                    value: p,
                    label: p,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t`Police des titres`} name="policeTitre">
                <Select
                  allowClear
                  placeholder={t`Police de Relaytour`}
                  options={POLICES_DISPONIBLES.map(p => ({
                    value: p,
                    label: p,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </Panneau>

        <Button
          type="primary"
          htmlType="submit"
          loading={modification.loading}
          style={{ alignSelf: 'flex-start' }}
        >
          <Trans>Enregistrer l’identité</Trans>
        </Button>
      </Form>

      <div className="rt-colonne" style={{ gap: 24 }}>
        <Panneau titre={t`Contenu de l’organisation`}>
          <p className="rt-texte-secondaire">
            <Trans>
              L’archive contient l’identité, les activités, les périmètres, les
              fiches, les tâches types et les images, dans la forme du dépôt
              organisation-modele. Elle ne contient aucune personne, aucune
              affectation ni aucune tâche datée.
            </Trans>
          </p>
          {aExporter && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title={t`Le dossier de contenu ne reflète pas les dernières modifications.`}
              description={t`Des admins ont modifié le contenu le ${dateModification}. Exportez-le avant tout import, sinon l’import refusera d’écraser ces modifications.`}
            />
          )}
          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              loading={exportEnCours}
              onClick={() => void telecharger()}
            >
              <Trans>Télécharger le contenu (zip)</Trans>
            </Button>
            {identite?.contenuSynchroniseLe && (
              <span className="rt-texte-secondaire">
                <Trans>Dernier import ou export : {dateSynchronisation}</Trans>
              </span>
            )}
          </Space>
        </Panneau>

        <Panneau titre={t`Importer un dossier de contenu`}>
          <p className="rt-texte-secondaire">
            <Trans>
              L’import reprend une archive au format de l’export : celle d’une
              autre installation, ou un dossier modifié hors de l’application.
              Il crée ou met à jour les activités, les périmètres, les fiches et
              les tâches types. Il ne retire rien et ne change pas l’identifiant
              de l’organisation.
            </Trans>
          </p>
          <DepotContenu />
        </Panneau>
      </div>
    </>
  )
}
