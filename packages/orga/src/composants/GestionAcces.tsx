import { useMutation, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Alert,
  App,
  Button,
  Form,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Switch,
  Tag,
} from 'antd'
import { useState } from 'react'

import type {
  AccesFournisseurDossier,
  RoleFournisseur,
  VerificationAccesQuery,
} from '../gql/graphql'
import { messageErreur } from '../lib/erreurs'
import {
  APPLIQUER_PROPOSITION,
  APPLIQUER_PROPOSITIONS,
  ECARTER_PROPOSITION,
  GROUPES_DU_DOSSIER,
  MODES_ACCES as MODES,
  REGLER_ACCES,
} from '../lib/espace-fichiers'
import { Section } from './Panneau'

// Propositions d'accès chez le fournisseur et réglage du mode d'un dossier lié
// (ADR 0044). Relaytour propose ; un admin de l'organisation applique.

type Verification = VerificationAccesQuery['verificationAcces'][number]
type Dossier = Verification['dossier']

/** La fenêtre où un admin règle comment Relaytour propose les accès d'un dossier. */
export function ReglageAcces({
  dossier,
  gestion,
  onActiverGestion,
  onFermer,
}: {
  dossier: Dossier
  /** Vrai quand la connexion permet d'appliquer des propositions. */
  gestion: boolean
  onActiverGestion: (() => void) | null
  onFermer: () => void
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const [mode, setMode] = useState<AccesFournisseurDossier>(
    dossier.accesFournisseur
  )
  const [groupeId, setGroupeId] = useState<string | null>(
    dossier.groupeFournisseurId ?? null
  )
  const [role, setRole] = useState<RoleFournisseur>(dossier.roleFournisseur)
  const [auto, setAuto] = useState(dossier.ajoutsAutomatiques)
  const [invitation, setInvitation] = useState(dossier.invitationFournisseur)
  const groupes = useQuery(GROUPES_DU_DOSSIER, {
    variables: { id: dossier.id },
    skip: !gestion,
  })
  const [regler, { loading }] = useMutation(REGLER_ACCES, {
    refetchQueries: ['VerificationAcces'],
  })
  const pret = mode !== 'GROUPE' || groupeId !== null
  const enregistrer = () =>
    regler({
      variables: {
        id: dossier.id,
        mode,
        groupeId: mode === 'GROUPE' ? groupeId : null,
        role,
        ajoutsAutomatiques: auto,
        invitation,
      },
    })
      .then(() => {
        message.success(t`Le réglage des accès est enregistré.`)
        onFermer()
      })
      .catch((e: unknown) => message.error(messageErreur(e)))

  const nomDossier = dossier.nom
  return (
    <Modal
      open
      title={t`Accès chez le fournisseur : « ${nomDossier} »`}
      onCancel={onFermer}
      okText={t`Enregistrer`}
      okButtonProps={{ loading, disabled: !gestion || !pret }}
      onOk={() => void enregistrer()}
      width={600}
    >
      {!gestion && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={t`Avec cette connexion, Relaytour vérifie les accès sans pouvoir les changer.`}
          description={
            onActiverGestion === null ? (
              t`Ce fournisseur ne propose pas encore la gestion des accès.`
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  <Trans>
                    Pour appliquer des propositions, activez la gestion des
                    accès. Chez Microsoft et Dropbox, elle demande une
                    reconnexion ; chez Microsoft, un admin Microsoft Entra
                    accepte une autorisation de plus.
                  </Trans>
                </p>
                <Button onClick={onActiverGestion}>
                  {t`Activer la gestion des accès`}
                </Button>
              </>
            )
          }
        />
      )}
      <Form layout="vertical" component="div" disabled={!gestion}>
        <Form.Item label={t`Relaytour propose`}>
          <Radio.Group
            value={mode}
            onChange={e => setMode(e.target.value as AccesFournisseurDossier)}
            options={(Object.keys(MODES) as AccesFournisseurDossier[]).map(
              m => ({ value: m, label: t(MODES[m]) })
            )}
          />
        </Form.Item>
        {mode === 'GROUPE' && (
          <Form.Item
            label={t({
              message: 'Groupe',
              comment: 'Groupe chez le fournisseur cloud',
            })}
            extra={t`La liste ne compte que les groupes qui ont déjà un droit sur le dossier. Une personne qui entre dans un groupe reçoit tous les droits de ce groupe chez le fournisseur.`}
          >
            <Select
              value={groupeId}
              onChange={setGroupeId}
              loading={groupes.loading}
              placeholder={
                dossier.groupeFournisseurNom ?? t`Choisissez un groupe`
              }
              options={(groupes.data?.groupesDuDossier ?? []).map(g => ({
                value: g.identifiant,
                label: g.nom,
              }))}
              notFoundContent={t`Aucun groupe du fournisseur n’a de droit sur ce dossier.`}
            />
          </Form.Item>
        )}
        {mode === 'PARTAGE' && (
          <>
            <Form.Item label={t`Rôle`}>
              <Radio.Group
                value={role}
                onChange={e => setRole(e.target.value as RoleFournisseur)}
                options={[
                  { value: 'LECTURE', label: t`Lecture` },
                  { value: 'ECRITURE', label: t`Écriture` },
                ]}
              />
            </Form.Item>
            {/* Nextcloud prévient la personne selon ses propres réglages. */}
            {dossier.fournisseur !== 'NEXTCLOUD' && (
              <Form.Item
                label={t`Mail d’invitation du fournisseur`}
                extra={t`Le fournisseur prévient la personne du partage.`}
              >
                <Switch checked={invitation} onChange={setInvitation} />
              </Form.Item>
            )}
          </>
        )}
        {mode !== 'AUCUN' && (
          <Form.Item
            label={t`Appliquer les ajouts sans attendre`}
            extra={t`Un retrait attend toujours la décision d’un admin. Relaytour ne retire que les accès qu’il a lui-même créés.`}
          >
            <Switch checked={auto} onChange={setAuto} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

/** Les propositions d'un dossier : à appliquer, à écarter, ou en échec. */
export function PropositionsDossier({ v }: { v: Verification }) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const relire = { refetchQueries: ['VerificationAcces'] }
  const [appliquer, { loading: application }] = useMutation(
    APPLIQUER_PROPOSITION,
    relire
  )
  const [toutAppliquer, { loading: lot }] = useMutation(
    APPLIQUER_PROPOSITIONS,
    relire
  )
  const [ecarter] = useMutation(ECARTER_PROPOSITION, relire)
  if (v.propositions.length === 0) return null
  const enAttente = v.propositions.filter(p => p.etat === 'EN_ATTENTE')
  // La cible vient du serveur : un retrait vise le droit que Relaytour a créé,
  // quel que soit le mode actuel du dossier.
  const libelle = (p: {
    action: string
    cible: string
    parGroupe: boolean
  }) => {
    const cible = p.cible
    return p.action === 'AJOUTER'
      ? p.parGroupe
        ? t`Ajouter au ${cible}`
        : t`Partager le dossier`
      : p.parGroupe
        ? t`Retirer du ${cible}`
        : t`Retirer le partage`
  }
  const titreApplication = (
    p: Parameters<typeof libelle>[0] & {
      personne: { nom: string }
    }
  ) => {
    const action = libelle(p)
    const personne = p.personne.nom
    return t`${action} pour ${personne} ?`
  }
  const echecProposition = (erreur: string | null | undefined) => {
    const raison = erreur ?? t`Échec`
    return t`${raison} Relaytour le proposera de nouveau à la prochaine vérification.`
  }
  const nombreEnAttente = enAttente.length
  return (
    <Section titre={t`Propositions`} compte={t`${nombreEnAttente} en attente`}>
      {enAttente.length > 1 && (
        <Popconfirm
          title={t`Appliquer toutes les propositions de ce dossier ?`}
          description={t`Relaytour les applique une à une chez le fournisseur.`}
          okText={t`Appliquer`}
          cancelText={t`Annuler`}
          onConfirm={() =>
            toutAppliquer({ variables: { dossierId: v.dossier.id } })
              .then(r => {
                const appliquees = r.data?.appliquerPropositionsDossier ?? 0
                return message.success(
                  t`${appliquees} proposition(s) appliquée(s).`
                )
              })
              .catch((e: unknown) => message.error(messageErreur(e)))
          }
        >
          <Button size="small" loading={lot} style={{ marginBottom: 8 }}>
            {t`Tout appliquer`}
          </Button>
        </Popconfirm>
      )}
      <ul className="rt-explorateur">
        {v.propositions.map(p => (
          <li key={p.id} className="rt-explorateur-ligne rt-acces-ligne">
            <span className="rt-explorateur-nom">
              {p.personne.nom}
              <span className="rt-explorateur-detail">
                {[
                  libelle(p),
                  p.personne.email,
                  p.etat === 'ECHEC' ? echecProposition(p.erreur) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            {p.etat === 'ECHEC' ? (
              <Tag color="error">{t`Échec`}</Tag>
            ) : (
              <Popconfirm
                title={titreApplication(p)}
                description={
                  p.parGroupe && p.action === 'RETIRER'
                    ? t`La personne quitte le groupe pour tout ce que ce groupe ouvre chez le fournisseur.`
                    : t`Relaytour applique le changement chez le fournisseur.`
                }
                okText={t`Appliquer`}
                cancelText={t`Annuler`}
                onConfirm={() =>
                  appliquer({ variables: { id: p.id } })
                    .then(r =>
                      r.data?.appliquerPropositionAcces === 'APPLIQUEE'
                        ? message.success(t`Le changement est appliqué.`)
                        : message.error(
                            t`Le fournisseur a refusé le changement.`
                          )
                    )
                    .catch((e: unknown) => message.error(messageErreur(e)))
                }
              >
                <Button size="small" type="primary" loading={application}>
                  {t`Appliquer`}
                </Button>
              </Popconfirm>
            )}
            <Button
              size="small"
              onClick={() =>
                ecarter({ variables: { id: p.id } }).catch((e: unknown) =>
                  message.error(messageErreur(e))
                )
              }
            >
              {t`Écarter`}
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  )
}
