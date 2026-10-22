import { useMutation, useQuery } from '@apollo/client/react'
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
  const { message } = App.useApp()
  const [mode, setMode] = useState<AccesFournisseurDossier>(
    dossier.accesFournisseur
  )
  const [groupeId, setGroupeId] = useState<string | null>(null)
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
        message.success('Le réglage des accès est enregistré.')
        onFermer()
      })
      .catch((e: unknown) => message.error(messageErreur(e)))

  return (
    <Modal
      open
      title={`Accès chez le fournisseur : « ${dossier.nom} »`}
      onCancel={onFermer}
      okText="Enregistrer"
      okButtonProps={{ loading, disabled: !gestion || !pret }}
      onOk={() => void enregistrer()}
      width={600}
    >
      {!gestion && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="La connexion vérifie les accès sans pouvoir les changer."
          description={
            onActiverGestion === null ? (
              'Ce fournisseur ne propose pas encore la gestion des accès.'
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  Pour appliquer des propositions, reconnectez le fournisseur
                  avec la gestion des accès. Chez Microsoft, un admin Microsoft
                  Entra accepte une autorisation de plus.
                </p>
                <Button onClick={onActiverGestion}>
                  Activer la gestion des accès
                </Button>
              </>
            )
          }
        />
      )}
      <Form layout="vertical" component="div" disabled={!gestion}>
        <Form.Item label="Relaytour propose">
          <Radio.Group
            value={mode}
            onChange={e => setMode(e.target.value as AccesFournisseurDossier)}
            options={(Object.keys(MODES) as AccesFournisseurDossier[]).map(
              m => ({ value: m, label: MODES[m] })
            )}
          />
        </Form.Item>
        {mode === 'GROUPE' && (
          <Form.Item
            label="Groupe"
            extra="Seuls les groupes qui ont déjà un droit sur le dossier se proposent. Entrer dans un groupe ouvre tout ce que ce groupe ouvre chez le fournisseur."
          >
            <Select
              value={groupeId}
              onChange={setGroupeId}
              loading={groupes.loading}
              placeholder={
                dossier.groupeFournisseurNom ?? 'Choisissez un groupe'
              }
              options={(groupes.data?.groupesDuDossier ?? []).map(g => ({
                value: g.identifiant,
                label: g.nom,
              }))}
              notFoundContent="Aucun groupe du fournisseur n’a de droit sur ce dossier."
            />
          </Form.Item>
        )}
        {mode === 'PARTAGE' && (
          <>
            <Form.Item label="Rôle">
              <Radio.Group
                value={role}
                onChange={e => setRole(e.target.value as RoleFournisseur)}
                options={[
                  { value: 'LECTURE', label: 'Lecture' },
                  { value: 'ECRITURE', label: 'Écriture' },
                ]}
              />
            </Form.Item>
            <Form.Item
              label="Mail d’invitation du fournisseur"
              extra="Le fournisseur prévient la personne du partage."
            >
              <Switch checked={invitation} onChange={setInvitation} />
            </Form.Item>
          </>
        )}
        {mode !== 'AUCUN' && (
          <Form.Item
            label="Appliquer les ajouts sans attendre"
            extra="Un retrait attend toujours un admin. Relaytour ne retire que les accès qu’il a lui-même créés."
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
  const groupe = v.dossier.accesFournisseur === 'GROUPE'
  const libelle = (action: string) =>
    action === 'AJOUTER'
      ? groupe
        ? `Ajouter au groupe « ${v.dossier.groupeFournisseurNom ?? ''} »`
        : 'Partager le dossier'
      : groupe
        ? `Retirer du groupe « ${v.dossier.groupeFournisseurNom ?? ''} »`
        : 'Retirer le partage'
  return (
    <Section titre="Propositions" compte={`${enAttente.length} en attente`}>
      {enAttente.length > 1 && (
        <Popconfirm
          title="Appliquer toutes les propositions de ce dossier ?"
          description="Relaytour les applique une à une chez le fournisseur."
          okText="Appliquer"
          cancelText="Annuler"
          onConfirm={() =>
            toutAppliquer({ variables: { dossierId: v.dossier.id } })
              .then(r =>
                message.success(
                  `${r.data?.appliquerPropositionsDossier ?? 0} proposition(s) appliquée(s).`
                )
              )
              .catch((e: unknown) => message.error(messageErreur(e)))
          }
        >
          <Button size="small" loading={lot} style={{ marginBottom: 8 }}>
            Tout appliquer
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
                  libelle(p.action),
                  p.personne.email,
                  p.etat === 'ECHEC'
                    ? `${p.erreur ?? 'Échec'} Relaytour le proposera de nouveau à la prochaine vérification.`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            {p.etat === 'ECHEC' ? (
              <Tag color="error">Échec</Tag>
            ) : (
              <Popconfirm
                title={`${libelle(p.action)} pour ${p.personne.nom} ?`}
                description={
                  groupe && p.action === 'RETIRER'
                    ? 'La personne quitte le groupe pour tout ce que ce groupe ouvre chez le fournisseur.'
                    : 'Relaytour applique le changement chez le fournisseur.'
                }
                okText="Appliquer"
                cancelText="Annuler"
                onConfirm={() =>
                  appliquer({ variables: { id: p.id } })
                    .then(r =>
                      r.data?.appliquerPropositionAcces === 'APPLIQUEE'
                        ? message.success('Le changement est appliqué.')
                        : message.error(
                            'Le fournisseur a refusé le changement.'
                          )
                    )
                    .catch((e: unknown) => message.error(messageErreur(e)))
                }
              >
                <Button size="small" type="primary" loading={application}>
                  Appliquer
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
              Écarter
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  )
}
