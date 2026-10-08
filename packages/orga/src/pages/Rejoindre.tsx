import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Radio,
  Result,
  Skeleton,
  Typography,
} from 'antd'
import { useState } from 'react'
import { useParams } from 'react-router'

import Marque, { SignatureRelaytour } from '../composants/Marque'
import { graphql } from '../gql'
import { messageErreur } from '../lib/erreurs'

// Formulaire public pour rejoindre l'équipe d'une activité (ADR 0015). La page se lit
// sans session. Elle dépose une demande : aucun compte n'existe avant la décision d'un
// admin, et aucun mail ne part vers l'adresse saisie.

const FORMULAIRE = graphql(`
  query FormulaireRejoindre($organisation: String, $activite: String!) {
    formulaireRejoindre(organisation: $organisation, activite: $activite) {
      organisation
      activite
      periode
      introduction
      question
      paliers
      contact
      groupes {
        libelle
        perimetres {
          slug
          nom
          description
          couleur
        }
      }
    }
  }
`)

const ENVOYER = graphql(`
  mutation EnvoyerDemande(
    $organisation: String
    $activite: String!
    $nom: String!
    $email: String!
    $perimetres: [String!]!
    $disponibilite: String
    $reponse: String
    $texte: String
    $siteWeb: String
  ) {
    envoyerDemande(
      organisation: $organisation
      activite: $activite
      nom: $nom
      email: $email
      perimetres: $perimetres
      disponibilite: $disponibilite
      reponse: $reponse
      texte: $texte
      siteWeb: $siteWeb
    )
  }
`)

interface Valeurs {
  nom: string
  email: string
  reponse?: string
  perimetres?: string[]
  disponibilite?: string
  texte?: string
  siteWeb?: string
}

export default function Rejoindre() {
  const { organisation, activite = '' } = useParams()
  const variables = { organisation: organisation ?? null, activite }
  const { data, loading } = useQuery(FORMULAIRE, { variables })
  const [envoyer, envoi] = useMutation(ENVOYER)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoyee, setEnvoyee] = useState(false)
  const formulaire = data?.formulaireRejoindre

  const deposer = async (v: Valeurs) => {
    setErreur(null)
    try {
      await envoyer({
        variables: {
          ...variables,
          nom: v.nom,
          email: v.email,
          perimetres: v.perimetres ?? [],
          disponibilite: v.disponibilite ?? null,
          reponse: v.reponse ?? null,
          texte: v.texte ?? null,
          siteWeb: v.siteWeb ?? null,
        },
      })
      setEnvoyee(true)
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  return (
    <main
      className="rt-page-seule"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div className="rt-halo rt-halo-1" aria-hidden="true" />
      <div className="rt-halo rt-halo-2" aria-hidden="true" />
      <Card
        style={{ width: '100%', maxWidth: 720 }}
        styles={{ body: { padding: 32 } }}
      >
        <Marque taille={30} />
        {loading && !data ? (
          <Skeleton active />
        ) : !formulaire ? (
          <Result
            status="info"
            title="Ce formulaire n’est pas ouvert."
            subTitle="Contactez l’organisation pour rejoindre son équipe."
          />
        ) : envoyee ? (
          <Result
            status="success"
            title="Votre demande est enregistrée."
            subTitle="L’équipe l’examine, puis vous écrit à l’adresse indiquée."
          />
        ) : (
          <>
            <h1
              className="rt-titre"
              style={{
                fontSize: 'calc(30px * var(--rt-titre-echelle))',
                margin: '0 0 6px',
              }}
            >
              Rejoindre l’équipe
            </h1>
            <Typography.Paragraph style={{ color: 'var(--rt-encre-70)' }}>
              {formulaire.activite}, {formulaire.periode}
            </Typography.Paragraph>
            {formulaire.introduction && (
              <Typography.Paragraph>
                {formulaire.introduction}
              </Typography.Paragraph>
            )}

            {erreur && (
              <Alert
                type="error"
                showIcon
                title={erreur}
                style={{ marginBottom: 16 }}
              />
            )}

            <Form<Valeurs>
              layout="vertical"
              onFinish={v => void deposer(v)}
              requiredMark={false}
            >
              <Form.Item
                label="Prénom et nom"
                name="nom"
                rules={[
                  {
                    required: true,
                    message: 'Saisissez votre prénom et votre nom.',
                  },
                ]}
              >
                <Input maxLength={120} autoComplete="name" />
              </Form.Item>
              <Form.Item
                label="Adresse mail"
                name="email"
                rules={[
                  {
                    required: true,
                    type: 'email',
                    message: 'Saisissez une adresse mail valide.',
                  },
                ]}
              >
                <Input type="email" autoComplete="email" />
              </Form.Item>
              {formulaire.question && (
                <Form.Item label={formulaire.question} name="reponse">
                  <Input maxLength={120} />
                </Form.Item>
              )}

              {formulaire.groupes.length > 0 && (
                <Form.Item
                  label="Ce qui vous intéresse (plusieurs choix possibles)"
                  name="perimetres"
                  extra="Sans choix de votre part, l’équipe vous propose un rôle."
                >
                  <Checkbox.Group style={{ display: 'block' }}>
                    {formulaire.groupes.map(groupe => (
                      <fieldset
                        key={groupe.libelle}
                        style={{ border: 0, margin: '0 0 12px', padding: 0 }}
                      >
                        <legend
                          className="rt-libelle"
                          style={{ marginBottom: 6 }}
                        >
                          {groupe.libelle}
                        </legend>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          {groupe.perimetres.map(p => (
                            <Checkbox key={p.slug} value={p.slug}>
                              <span style={{ fontWeight: 600 }}>{p.nom}</span>
                              {p.description && (
                                <span
                                  className="rt-texte-secondaire"
                                  style={{ display: 'block' }}
                                >
                                  {p.description}
                                </span>
                              )}
                            </Checkbox>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </Checkbox.Group>
                </Form.Item>
              )}

              {formulaire.paliers.length > 0 && (
                <Form.Item label="Votre disponibilité" name="disponibilite">
                  <Radio.Group
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                    options={formulaire.paliers.map(palier => ({
                      value: palier,
                      label: palier,
                    }))}
                  />
                </Form.Item>
              )}

              <Form.Item
                label="Ce que vous aimez faire ou savez faire"
                name="texte"
              >
                <Input.TextArea rows={3} maxLength={600} showCount />
              </Form.Item>

              {/* Champ piège : une personne ne le voit pas, un robot le remplit. */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: -9999,
                  height: 0,
                  overflow: 'hidden',
                }}
              >
                <Form.Item label="Site web" name="siteWeb">
                  <Input tabIndex={-1} autoComplete="off" />
                </Form.Item>
              </div>

              <Typography.Paragraph
                className="rt-note"
                style={{ marginBottom: 16 }}
              >
                {formulaire.organisation} utilise ces informations pour
                constituer l’équipe de {formulaire.periode} et vous contacter à
                ce sujet. Les admins de l’activité les lisent. Elles sont
                supprimées à l’archivage de la période. Vous pouvez demander
                l’accès à vos informations ou leur suppression à{' '}
                <a href={`mailto:${formulaire.contact}`}>
                  {formulaire.contact}
                </a>
                .
              </Typography.Paragraph>

              <Button
                type="primary"
                size="large"
                htmlType="submit"
                loading={envoi.loading}
                block
              >
                Envoyer ma demande
              </Button>
            </Form>
          </>
        )}
        <SignatureRelaytour />
      </Card>
    </main>
  )
}
