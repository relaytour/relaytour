import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { plural, t } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Result,
  Select,
  Skeleton,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import { useParams } from 'react-router'

import Marque, { SignatureRelaytour } from '../composants/Marque'
import PastillePerimetre from '../composants/PastillePerimetre'
import { graphql } from '../gql'
import type { AppelBenevolesPublicQuery } from '../gql/graphql'
import { decalerJour, libelleJours } from '../lib/agenda'
import { messageErreur } from '../lib/erreurs'
import { minutes } from '../lib/programme'

// Page publique d'un appel à bénévoles (ADR 0041). Elle se lit sans session. La
// personne choisit les séquences qui cherchent des bénévoles, donne ses plages de
// disponibilité et dépose sa candidature. Aucun mail ne part au dépôt : l'équipe
// examine la candidature, puis écrit si elle retient une place.

const APPEL = graphql(`
  query AppelBenevolesPublic($jeton: String!) {
    appelBenevolesPublic(jeton: $jeton) {
      organisation
      activite
      periode
      introduction
      contact
      ouAilleurs
      jours
      sequences {
        ref
        titre
        jour
        jourFin
        heureDebut
        heureFin
        lieu
        lieuDescription
        perimetre
        couleur
        consignes
        placesRecherchees
        complete
      }
    }
  }
`)

const DEPOSER = graphql(`
  mutation DeposerCandidature(
    $jeton: String!
    $nom: String!
    $email: String!
    $telephone: String
    $sequences: [String!]!
    $ouAilleurs: Boolean
    $plages: [PlageDisponibiliteInput!]
    $precisions: String
    $message: String
    $accord: Boolean!
    $siteWeb: String
  ) {
    deposerCandidature(
      jeton: $jeton
      nom: $nom
      email: $email
      telephone: $telephone
      sequences: $sequences
      ouAilleurs: $ouAilleurs
      plages: $plages
      precisions: $precisions
      message: $message
      accord: $accord
      siteWeb: $siteWeb
    )
  }
`)

type SequencePublique = NonNullable<
  AppelBenevolesPublicQuery['appelBenevolesPublic']
>['sequences'][number]

interface PlageSaisie {
  jour?: string
  heureDebut?: string
  heureFin?: string
}

interface Valeurs {
  sequences?: string[]
  ouAilleurs?: boolean
  plages?: PlageSaisie[]
  precisions?: string
  nom: string
  email: string
  telephone?: string
  message?: string
  accord?: boolean
  siteWeb?: string
}

/**
 * Un horaire sur un axe commun à tous les jours, en minutes : deux moments qui
 * commencent des jours différents se comparent aussi.
 */
function intervalle(s: SequencePublique): { debut: number; fin: number } {
  const jour = (j: string) => Date.parse(`${j}T00:00:00Z`) / 60_000
  return {
    debut: jour(s.jour) + minutes(s.heureDebut),
    fin: jour(s.jourFin) + minutes(s.heureFin),
  }
}

/** Les paires de séquences choisies qui se chevauchent. */
function chevauchements(choisies: readonly SequencePublique[]): string[] {
  const paires: string[] = []
  choisies.forEach((a, i) =>
    choisies.slice(i + 1).forEach(b => {
      const x = intervalle(a)
      const y = intervalle(b)
      if (x.debut < y.fin && y.debut < x.fin) {
        const titrePremier = a.titre
        const titreSecond = b.titre
        paires.push(t`« ${titrePremier} » et « ${titreSecond} »`)
      }
    })
  )
  return paires
}

/** Le nombre de places recherchées sur une séquence. */
function libellePlaces(places: number): string {
  return t`${plural(places, { one: '# place recherchée', other: '# places recherchées' })}`
}

export default function AppelBenevoles() {
  const { t } = useLingui()
  const { jeton = '' } = useParams()
  const [form] = Form.useForm<Valeurs>()
  const { data, loading } = useQuery(APPEL, { variables: { jeton } })
  const [deposer, depot] = useMutation(DEPOSER)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoyee, setEnvoyee] = useState(false)
  const appel = data?.appelBenevolesPublic
  const refs = Form.useWatch('sequences', form) ?? []

  const parJour = new Map<string, SequencePublique[]>()
  for (const s of appel?.sequences ?? []) {
    parJour.set(s.jour, [...(parJour.get(s.jour) ?? []), s])
  }
  const choisies = (appel?.sequences ?? []).filter(s => refs.includes(s.ref))
  const conflits = chevauchements(choisies)
  const listeConflits = conflits.join(', ')
  const nomOrganisation = appel?.organisation
  const adresseContact = appel?.contact

  const envoyer = async (v: Valeurs) => {
    setErreur(null)
    try {
      await deposer({
        variables: {
          jeton,
          nom: v.nom,
          email: v.email,
          telephone: v.telephone ?? null,
          sequences: v.sequences ?? [],
          ouAilleurs: v.ouAilleurs ?? false,
          plages: (v.plages ?? [])
            .filter(p => p?.jour && p.heureDebut && p.heureFin)
            .map(p => ({
              jour: p.jour!,
              heureDebut: p.heureDebut!,
              heureFin: p.heureFin!,
              // Une fin avant le début passe minuit.
              jourFin:
                minutes(p.heureFin!) <= minutes(p.heureDebut!)
                  ? decalerJour(p.jour!, 1)
                  : null,
            })),
          precisions: v.precisions ?? null,
          message: v.message ?? null,
          accord: v.accord === true,
          siteWeb: v.siteWeb ?? null,
        },
      })
      setEnvoyee(true)
      window.scrollTo(0, 0)
    } catch (e) {
      setErreur(messageErreur(e))
    }
  }

  return (
    <main className="rt-page-seule rt-page-publique">
      <div className="rt-halo rt-halo-1" aria-hidden="true" />
      <div className="rt-halo rt-halo-2" aria-hidden="true" />
      <Card className="rt-carte-publique" styles={{ body: { padding: 28 } }}>
        <Marque taille={30} />
        {loading && !data ? (
          <Skeleton active />
        ) : !appel ? (
          <Result
            status="info"
            title={t`Cet appel n’est pas ouvert.`}
            subTitle={t`Il est peut-être fermé, ou son adresse a changé. Contactez l’organisation pour proposer votre aide.`}
          />
        ) : envoyee ? (
          <Result
            status="success"
            title={t`Votre candidature est enregistrée.`}
            subTitle={t`L’équipe l’examine. Si elle vous propose une place, vous recevez un mail avec un lien pour confirmer votre participation.`}
          />
        ) : (
          <>
            <h1 className="rt-titre rt-titre-public">
              <Trans>Devenir bénévole</Trans>
            </h1>
            <Typography.Paragraph style={{ color: 'var(--rt-encre-70)' }}>
              {appel.activite}, {appel.periode}
            </Typography.Paragraph>
            {appel.introduction && (
              <Typography.Paragraph>{appel.introduction}</Typography.Paragraph>
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
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{ plages: [{}], sequences: [] }}
              onFinish={v => void envoyer(v)}
            >
              <h2 className="rt-intertitre-public">
                <Trans>Les moments où nous avons besoin de vous</Trans>
              </h2>
              {appel.sequences.length === 0 ? (
                <Typography.Paragraph className="rt-note">
                  <Trans>
                    Aucun moment ne cherche de bénévoles pour l’instant.
                  </Trans>
                </Typography.Paragraph>
              ) : (
                <Form.Item
                  name="sequences"
                  rules={[
                    {
                      validator: (_r, valeur?: string[]) =>
                        (valeur?.length ?? 0) > 0 ||
                        form.getFieldValue('ouAilleurs')
                          ? Promise.resolve()
                          : Promise.reject(
                              new Error(
                                appel.ouAilleurs
                                  ? t`Choisissez au moins un moment, ou proposez votre aide là où il manque du monde.`
                                  : t`Choisissez au moins un moment.`
                              )
                            ),
                    },
                  ]}
                >
                  <Checkbox.Group className="rt-moments">
                    {[...parJour.entries()].map(([jour, liste]) => (
                      <fieldset key={jour} className="rt-moments-jour">
                        <legend className="rt-libelle">
                          {libelleJours(jour)}
                        </legend>
                        {liste.map(s => (
                          <Checkbox
                            key={s.ref}
                            value={s.ref}
                            className="rt-moment"
                          >
                            <span className="rt-moment-tete">
                              <strong>{s.titre}</strong>
                              <span className="rt-note">
                                {s.heureDebut} → {s.heureFin}
                                {s.lieu && ` · ${s.lieu}`}
                              </span>
                            </span>
                            <span className="rt-moment-etiquettes">
                              {s.perimetre && (
                                <PastillePerimetre
                                  nom={s.perimetre}
                                  couleur={s.couleur}
                                />
                              )}
                              {s.complete ? (
                                <Tag color="warning">
                                  <Trans>Complet : liste d’attente</Trans>
                                </Tag>
                              ) : (
                                <Tag color="success">
                                  {libellePlaces(s.placesRecherchees)}
                                </Tag>
                              )}
                            </span>
                            {s.consignes && (
                              <span className="rt-texte-secondaire rt-moment-texte">
                                {s.consignes}
                              </span>
                            )}
                            {s.lieuDescription && (
                              <span className="rt-note rt-moment-texte">
                                {s.lieu} : {s.lieuDescription}
                              </span>
                            )}
                          </Checkbox>
                        ))}
                      </fieldset>
                    ))}
                  </Checkbox.Group>
                </Form.Item>
              )}
              {conflits.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                  title={t`Ces moments se chevauchent : ${listeConflits}. L’équipe choisira avec vous.`}
                />
              )}
              {appel.ouAilleurs && (
                <Form.Item name="ouAilleurs" valuePropName="checked">
                  <Checkbox
                    onChange={() => void form.validateFields(['sequences'])}
                  >
                    <Trans>Je peux aussi aider là où il manque du monde.</Trans>
                  </Checkbox>
                </Form.Item>
              )}

              <h2 className="rt-intertitre-public">
                <Trans>Vos disponibilités</Trans>
              </h2>
              <Typography.Paragraph className="rt-note">
                <Trans>
                  Indiquez les plages horaires où vous pouvez aider. Une fin
                  avant le début passe minuit.
                </Trans>
              </Typography.Paragraph>
              <Form.List name="plages">
                {(champs, { add, remove }) => (
                  <div className="rt-plages">
                    {champs.map(champ => (
                      <div key={champ.key} className="rt-plage">
                        <Form.Item
                          name={[champ.name, 'jour']}
                          label={t`Jour`}
                          rules={[
                            { required: true, message: t`Choisissez un jour.` },
                          ]}
                        >
                          <Select
                            placeholder={t`Jour`}
                            options={appel.jours.map(j => ({
                              value: j,
                              label: libelleJours(j),
                            }))}
                          />
                        </Form.Item>
                        <Form.Item
                          name={[champ.name, 'heureDebut']}
                          label={t({
                            message: 'De',
                            comment:
                              'Heure de début d’une plage de disponibilité',
                          })}
                          rules={[{ required: true, message: t`Heure ?` }]}
                        >
                          <Input type="time" />
                        </Form.Item>
                        <Form.Item
                          name={[champ.name, 'heureFin']}
                          label={t({
                            message: 'À',
                            comment:
                              'Heure de fin d’une plage de disponibilité',
                          })}
                          rules={[{ required: true, message: t`Heure ?` }]}
                        >
                          <Input type="time" />
                        </Form.Item>
                        <Button
                          type="text"
                          icon={<DeleteOutlined />}
                          aria-label={t`Retirer cette plage`}
                          onClick={() => remove(champ.name)}
                        />
                      </div>
                    ))}
                    <Button
                      icon={<PlusOutlined />}
                      disabled={champs.length >= 20}
                      onClick={() => add({})}
                    >
                      <Trans>Ajouter une plage</Trans>
                    </Button>
                  </div>
                )}
              </Form.List>
              <Form.Item
                label={t`Précisions (facultatives)`}
                name="precisions"
                style={{ marginTop: 16 }}
              >
                <Input.TextArea
                  rows={2}
                  maxLength={600}
                  showCount
                  placeholder={t`À partir de 18 h, tout poste sauf la photo…`}
                />
              </Form.Item>

              <h2 className="rt-intertitre-public">
                <Trans>Vos coordonnées</Trans>
              </h2>
              <Form.Item
                label={t`Prénom et nom`}
                name="nom"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: t`Saisissez votre prénom et votre nom.`,
                  },
                ]}
              >
                <Input maxLength={120} autoComplete="name" />
              </Form.Item>
              <Form.Item
                label={t`Adresse mail`}
                name="email"
                extra={t`L’équipe vous écrit à cette adresse si elle vous propose une place.`}
                rules={[
                  {
                    required: true,
                    type: 'email',
                    message: t`Saisissez une adresse mail valide.`,
                  },
                ]}
              >
                <Input type="email" inputMode="email" autoComplete="email" />
              </Form.Item>
              <Form.Item label={t`Téléphone (facultatif)`} name="telephone">
                <Input type="tel" inputMode="tel" autoComplete="tel" />
              </Form.Item>
              <Form.Item
                label={t`Un mot pour l’équipe (facultatif)`}
                name="message"
              >
                <Input.TextArea rows={2} maxLength={600} showCount />
              </Form.Item>

              {/* Champ piège : une personne ne le voit pas, un robot le remplit. */}
              <div aria-hidden="true" className="rt-piege">
                <Form.Item label={t`Site web`} name="siteWeb">
                  <Input tabIndex={-1} autoComplete="off" />
                </Form.Item>
              </div>

              <Form.Item
                name="accord"
                valuePropName="checked"
                rules={[
                  {
                    validator: (_r, valeur?: boolean) =>
                      valeur
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error(
                              t`Votre candidature ne s’enregistre qu’avec votre accord.`
                            )
                          ),
                  },
                ]}
              >
                <Checkbox>
                  <Trans>
                    J’accepte que {nomOrganisation} enregistre ces informations
                    pour organiser l’activité.
                  </Trans>
                </Checkbox>
              </Form.Item>
              <Typography.Paragraph className="rt-note">
                <Trans>
                  Les personnes de l’équipe qui organisent ces moments lisent
                  votre candidature. Elle est supprimée à l’archivage de la
                  période. Si l’équipe vous propose une place, votre fiche de
                  bénévole est gardée deux ans au plus sans nouvelle place. Vous
                  pouvez demander l’accès à vos informations ou leur suppression
                  à <a href={`mailto:${adresseContact}`}>{adresseContact}</a>.
                </Trans>
              </Typography.Paragraph>

              <Button
                type="primary"
                size="large"
                htmlType="submit"
                loading={depot.loading}
                block
              >
                <Trans>Envoyer ma candidature</Trans>
              </Button>
            </Form>
          </>
        )}
        <SignatureRelaytour />
      </Card>
    </main>
  )
}
