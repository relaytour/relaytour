import { DownloadOutlined } from '@ant-design/icons'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
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
import { Panneau } from '../../composants/Panneau'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import { dateCourte, messageErreur } from '../../lib/erreurs'
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
      pageEquipe
      domainesCourrielAutorises
      adressesRoleAutorisees
      logoPng
      logoSvg
      favicon
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
    $pageEquipe: String
    $domainesCourrielAutorises: [String!]!
    $adressesRoleAutorisees: [String!]!
    $logoPng: String
    $logoSvg: String
    $favicon: String
    $theme: JSONObject
  ) {
    modifierIdentiteOrganisation(
      nom: $nom
      sigle: $sigle
      contactRecrutement: $contactRecrutement
      pageEquipe: $pageEquipe
      domainesCourrielAutorises: $domainesCourrielAutorises
      adressesRoleAutorisees: $adressesRoleAutorisees
      logoPng: $logoPng
      logoSvg: $logoSvg
      favicon: $favicon
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
const COULEURS: { cle: keyof CouleursTheme; libelle: string }[] = [
  { cle: 'primaire', libelle: 'Primaire' },
  { cle: 'accent', libelle: 'Accent' },
  { cle: 'encre', libelle: 'Encre (texte)' },
  { cle: 'sol1', libelle: 'Sol, haut' },
  { cle: 'sol2', libelle: 'Sol, milieu' },
  { cle: 'sol3', libelle: 'Sol, bas' },
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
  pageEquipe?: string
  domainesCourrielAutorises: string[]
  adressesRoleAutorisees: string[]
  logoPng: string | null
  logoSvg: string | null
  favicon: string | null
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
  const { message } = App.useApp()
  const apollo = useApolloClient()
  const { data, loading } = useQuery(IDENTITE)
  const [form] = Form.useForm<Valeurs>()
  const [erreur, setErreur] = useState<string | null>(null)
  const [exportEnCours, setExportEnCours] = useState(false)
  const [modifier, modification] = useMutation(MODIFIER, {
    refetchQueries: [IDENTITE, ORGANISATION, ACTIVITES],
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
      pageEquipe: identite.pageEquipe ?? '',
      domainesCourrielAutorises: identite.domainesCourrielAutorises,
      adressesRoleAutorisees: identite.adressesRoleAutorisees,
      logoPng: identite.logoPng ?? null,
      logoSvg: identite.logoSvg ?? null,
      favicon: identite.favicon ?? null,
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
          pageEquipe: v.pageEquipe || null,
          domainesCourrielAutorises: v.domainesCourrielAutorises,
          adressesRoleAutorisees: v.adressesRoleAutorisees,
          logoPng: v.logoPng,
          logoSvg: v.logoSvg,
          favicon: v.favicon,
          theme: themeDepuisFormulaire(declare, v),
        },
      })
      message.success('Identité enregistrée.')
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
      if (!resultat) throw new Error('L’export a échoué.')
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

  if (loading && !data) return <Skeleton active />

  return (
    <>
      <Titre sousTitre="Le nom, les contacts, le logo et le thème de l’organisation. Chaque activité peut surcharger les contacts, le logo, les couleurs et le fond.">
        Organisation
      </Titre>

      {erreur && (
        <Alert
          type="error"
          showIcon
          title={erreur}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={v => void enregistrer(v)}
      >
        <Panneau titre="Identité">
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item
                label="Nom"
                name="nom"
                rules={[{ required: true, message: 'Saisissez un nom.' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item label="Sigle (facultatif)" name="sigle">
                <Input maxLength={20} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Contact de l’organisation (facultatif)"
                name="contactRecrutement"
                extra="Une adresse de rôle, citée dans l’appel aux référentes et référents. Elle reçoit les réponses aux mails de l’organisation."
              >
                <Input type="email" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Page de l’équipe (facultatif)"
                name="pageEquipe"
              >
                <Input type="url" placeholder="https://" />
              </Form.Item>
            </Col>
          </Row>
          <p className="rt-texte-secondaire" style={{ margin: 0 }}>
            L’identifiant « {identite?.slug} » ne change pas ici : il dépend de
            l’hébergement.
          </p>
        </Panneau>

        <Panneau titre="Adresses de rôle">
          <p className="rt-texte-secondaire">
            Une adresse de rôle appartient à l’organisation, pas à une personne.
            Relaytour l’accepte dans les fiches et dans l’export du contenu. Il
            signale toute autre adresse comme une donnée personnelle. Ces
            réglages ne limitent pas les invitations.
          </p>
          <Form.Item
            label="Domaines des adresses de rôle"
            name="domainesCourrielAutorises"
            extra="Toute adresse de ces domaines passe pour une adresse de rôle. Relaytour refuse les messageries grand public."
          >
            <Select
              mode="tags"
              tokenSeparators={[',', ' ']}
              placeholder="exemple.org"
              open={false}
            />
          </Form.Item>
          <Form.Item
            label="Adresses de rôle chez une messagerie grand public"
            name="adressesRoleAutorisees"
            extra="Ajoutez ici une boîte partagée de l’organisation hébergée chez une messagerie grand public, adresse par adresse."
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
            title="Une adresse de rôle passe pour institutionnelle."
            description="Relaytour la publie alors sans avertissement dans les fiches et dans l’export du contenu. N’ajoutez jamais l’adresse d’une personne : le RGPD protège une adresse nominative comme une donnée personnelle, même hébergée chez une messagerie grand public."
          />
        </Panneau>

        <Panneau titre="Logo et favicon">
          <p className="rt-texte-secondaire">
            Le logo PNG s’affiche partout, y compris dans les mails. Le logo
            SVG, facultatif, le remplace à l’écran. Sans logo, l’espace affiche
            le pictogramme de Relaytour.
          </p>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Logo PNG (512 Ko au plus)" name="logoPng">
                <ChampImage format="PNG" libelle="Logo PNG" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Logo SVG (facultatif)" name="logoSvg">
                <ChampImage format="SVG" libelle="Logo SVG" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Favicon PNG (facultatif)" name="favicon">
                <ChampImage format="PNG" libelle="Favicon" />
              </Form.Item>
            </Col>
          </Row>
        </Panneau>

        <Panneau titre="Thème">
          <p className="rt-texte-secondaire">
            Une couleur vide reprend celle de Relaytour. Relaytour vérifie le
            contraste avant d’enregistrer.
          </p>
          <Row gutter={16}>
            {COULEURS.map(({ cle, libelle }) => (
              <Col xs={24} sm={12} md={8} key={cle}>
                <Form.Item label={libelle} name={['couleurs', cle]}>
                  <ChampCouleur heritee={themeParDefaut.couleurs[cle]} />
                </Form.Item>
              </Col>
            ))}
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Halo, premier" name="halo1">
                <ChampCouleur heritee={themeParDefaut.fond.halo1.couleur} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Halo, second" name="halo2">
                <ChampCouleur heritee={themeParDefaut.fond.halo2.couleur} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Police du texte" name="policeTexte">
                <Select
                  allowClear
                  placeholder="Police de Relaytour"
                  options={POLICES_DISPONIBLES.map(p => ({
                    value: p,
                    label: p,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Police des titres" name="policeTitre">
                <Select
                  allowClear
                  placeholder="Police de Relaytour"
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
          style={{ marginBottom: 24 }}
        >
          Enregistrer l’identité
        </Button>
      </Form>

      <Panneau titre="Contenu de l’organisation">
        <p className="rt-texte-secondaire">
          L’archive contient l’identité, les activités, les périmètres, les
          fiches, les tâches types et les images, dans la forme du dépôt
          organisation-modele. Elle ne contient aucune personne, aucune
          affectation ni aucune tâche datée.
        </p>
        {aExporter && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="Le dossier de contenu ne reflète pas les dernières modifications."
            description={`Des admins ont modifié le contenu le ${dateCourte(identite!.contenuModifieLe!)}. Exportez-le avant tout import, sinon l’import refusera d’écraser ces modifications.`}
          />
        )}
        <Space wrap>
          <Button
            icon={<DownloadOutlined />}
            loading={exportEnCours}
            onClick={() => void telecharger()}
          >
            Télécharger le contenu (zip)
          </Button>
          {identite?.contenuSynchroniseLe && (
            <span className="rt-texte-secondaire">
              Dernier import ou export :{' '}
              {dateCourte(identite.contenuSynchroniseLe)}
            </span>
          )}
        </Space>
      </Panneau>
    </>
  )
}
