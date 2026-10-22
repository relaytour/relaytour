import {
  FolderOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Alert, App, Button, Empty, Skeleton, Tag } from 'antd'
import { useState } from 'react'

import type {
  EtatAccesFournisseur,
  VerificationAccesQuery,
} from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import {
  AVEC_ANNUAIRE,
  CONSENTEMENT,
  resumeMode,
  VERIFICATION_ACCES,
  VERIFIER_ACCES,
  voieLisible,
} from '../lib/espace-fichiers'
import EtiquettePerimetre from './EtiquettePerimetre'
import EtiquettesLecteurs from './EtiquettesLecteurs'
import { PropositionsDossier, ReglageAcces } from './GestionAcces'
import { Panneau, Section } from './Panneau'

type Verification = VerificationAccesQuery['verificationAcces'][number]
type Ligne = Verification['lignes'][number]

const ETATS: Record<
  EtatAccesFournisseur,
  { libelle: string; couleur: string }
> = {
  A_ACCES: { libelle: 'A accès', couleur: 'success' },
  SANS_COMPTE: { libelle: 'Sans compte', couleur: 'error' },
  SANS_ACCES: { libelle: 'Sans accès', couleur: 'warning' },
  INCONNU: { libelle: 'Inconnu', couleur: 'default' },
  EN_TROP: { libelle: 'Accès en trop', couleur: 'default' },
}

const EXPLICATIONS: Partial<Record<EtatAccesFournisseur, string>> = {
  SANS_COMPTE:
    'L’annuaire du fournisseur ne connaît pas son adresse. Invitez la personne, ou saisissez l’adresse de son compte dans l’onglet « Comptes ».',
  SANS_ACCES: 'Son compte existe, mais aucun droit ne couvre ce dossier.',
  INCONNU:
    'Relaytour n’a pas pu lire les droits de ce dossier, ou les membres d’un groupe qui en a un.',
}

function LignePersonne({ ligne }: { ligne: Ligne }) {
  const etat = ETATS[ligne.etat]
  const detail =
    ligne.etat === 'A_ACCES'
      ? voieLisible(ligne.via)
      : (EXPLICATIONS[ligne.etat] ?? null)
  return (
    <li className="rt-explorateur-ligne rt-acces-ligne">
      <span className="rt-explorateur-nom">
        {ligne.nom}
        <span className="rt-explorateur-detail">
          {[ligne.personne?.email, detail].filter(Boolean).join(' · ')}
        </span>
      </span>
      <Tag color={etat.couleur}>{etat.libelle}</Tag>
    </li>
  )
}

/** Le résumé d'une équipe : « 4 sur 5 ont accès ». */
function resume(lignes: Ligne[]): string {
  const avecAcces = lignes.filter(l => l.etat === 'A_ACCES').length
  return `${avecAcces} sur ${lignes.length} ${avecAcces > 1 ? 'ont' : 'a'} accès`
}

function DossierVerifie({
  v,
  gestion,
  onActiverGestion,
}: {
  v: Verification
  gestion: boolean
  onActiverGestion: (() => void) | null
}) {
  const [reglage, setReglage] = useState(false)
  const attendues = v.lignes.filter(l => l.etat !== 'EN_TROP')
  const enTrop = v.lignes.filter(l => l.etat === 'EN_TROP')
  const sansEquipe = attendues.filter(l => l.perimetreIds.length === 0)
  const equipes = v.perimetres
    .map(p => ({
      perimetre: p,
      lignes: attendues.filter(l => l.perimetreIds.includes(p.id)),
    }))
    .filter(e => e.lignes.length > 0)
  const manques = attendues.filter(l => l.etat !== 'A_ACCES').length
  return (
    <Panneau
      titre={v.dossier.nom}
      icone={<FolderOutlined />}
      extra={
        <EtiquettesLecteurs
          touteActivite={v.dossier.touteActivite}
          perimetres={v.dossier.perimetres}
          groupes={v.dossier.groupes}
        />
      }
    >
      <div
        className="rt-puces"
        style={{ alignItems: 'center', marginBottom: 8 }}
      >
        <span className="rt-texte-secondaire">{resumeMode(v.dossier)}</span>
        <Button
          size="small"
          icon={<SettingOutlined />}
          onClick={() => setReglage(true)}
        >
          Gérer les accès
        </Button>
      </div>
      {reglage && (
        <ReglageAcces
          dossier={v.dossier}
          gestion={gestion}
          onActiverGestion={onActiverGestion}
          onFermer={() => setReglage(false)}
        />
      )}
      <PropositionsDossier v={v} />
      <p className="rt-texte-secondaire">
        {v.dossier.attendus === 'CONTACTS_PRINCIPAUX'
          ? 'Personnes attendues : les contacts principaux des périmètres lecteurs.'
          : 'Personnes attendues : les membres des périmètres lecteurs pour la période.'}{' '}
        {attendues.length === 0
          ? ''
          : manques === 0
            ? 'Toutes ont accès chez le fournisseur.'
            : `${manques} ${manques > 1 ? 'n’ont pas d’accès certain' : 'n’a pas d’accès certain'}.`}
      </p>
      {attendues.length === 0 && enTrop.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Aucune personne n’est attendue pour ce dossier."
        />
      ) : (
        <div className="rt-acces-equipes">
          {equipes.map(e => (
            <Section
              key={e.perimetre.id}
              titre={
                <EtiquettePerimetre
                  nom={e.perimetre.nom}
                  couleur={e.perimetre.couleur}
                  point
                />
              }
              compte={resume(e.lignes)}
            >
              <ul className="rt-explorateur">
                {e.lignes.map(l => (
                  <LignePersonne key={l.personne?.id ?? l.nom} ligne={l} />
                ))}
              </ul>
            </Section>
          ))}
          {sansEquipe.length > 0 && (
            <Section titre="Admins de l’activité" compte={resume(sansEquipe)}>
              <ul className="rt-explorateur">
                {sansEquipe.map(l => (
                  <LignePersonne key={l.personne?.id ?? l.nom} ligne={l} />
                ))}
              </ul>
            </Section>
          )}
          {enTrop.length > 0 && (
            <Section
              titre="Accès en trop"
              compte={`${enTrop.length} ${enTrop.length > 1 ? 'comptes' : 'compte'}`}
            >
              <p className="rt-texte-secondaire">
                Ces comptes ont un droit sur le dossier sans être attendus :
                coordination, ancienne équipe, compte d’une autre adresse.
                Relaytour n’en garde que le nom.
              </p>
              <ul className="rt-explorateur">
                {enTrop.map(l => (
                  <li
                    key={`${l.nom}-${l.via ?? ''}`}
                    className="rt-explorateur-ligne rt-acces-ligne"
                  >
                    <span className="rt-explorateur-nom">
                      {l.nom}
                      <span className="rt-explorateur-detail">
                        {voieLisible(l.via)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </Panneau>
  )
}

/**
 * L'onglet « Vérification des accès » (ADR 0044) : pour chaque dossier lié de
 * l'activité, les personnes attendues, rangées par équipe, et leur accès chez le
 * fournisseur à la dernière vérification.
 */
export default function VerificationAcces({
  connexion,
  onActiver,
  onActiverGestion,
}: {
  connexion: {
    fournisseur: string
    etat: string
    portee: string
    accesVerifieLe?: string | null
    accesErreur?: string | null
  }
  /** Ouvre la connexion qui lit l'annuaire, quand le fournisseur le permet. */
  onActiver: (() => void) | null
  /** Ouvre la connexion qui gère les accès, quand le fournisseur le permet. */
  onActiverGestion: (() => void) | null
}) {
  const { activite } = useActivite()
  const { message } = App.useApp()
  const active = connexion.portee !== 'FICHIERS'
  const { data, loading, error } = useQuery(VERIFICATION_ACCES, {
    variables: { activiteId: activite.id },
    skip: !active,
  })
  const [verifier, { loading: lancement }] = useMutation(VERIFIER_ACCES)

  if (!active) {
    return (
      <Panneau
        titre="Vérification des accès"
        icone={<SafetyCertificateOutlined />}
      >
        <p>
          Relaytour peut comparer les équipes aux droits des dossiers liés chez
          le fournisseur. Vous apprenez ainsi qui a un compte, qui a accès et
          qui a un accès en trop. Pour cela, Relaytour lit l’annuaire et les
          groupes du fournisseur, sans changer aucun droit.
        </p>
        {onActiver === null ? (
          <p className="rt-texte-secondaire">
            Ce fournisseur ne propose pas encore la vérification des accès.
          </p>
        ) : (
          <>
            <p className="rt-texte-secondaire">
              {CONSENTEMENT[connexion.fournisseur]}
            </p>
            <Button type="primary" onClick={onActiver}>
              Activer la vérification des accès
            </Button>
          </>
        )}
      </Panneau>
    )
  }

  const lancer = () =>
    verifier()
      .then(() =>
        message.success(
          'La vérification est lancée. Le résultat s’affiche dans quelques instants.'
        )
      )
      .catch((e: unknown) => message.error(messageErreur(e)))

  const verifications = data?.verificationAcces ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="rt-puces" style={{ alignItems: 'center' }}>
        <Button
          type="primary"
          icon={<SafetyCertificateOutlined />}
          loading={lancement}
          disabled={connexion.etat !== 'ACTIVE'}
          onClick={() => void lancer()}
        >
          Vérifier maintenant
        </Button>
        <span className="rt-texte-secondaire">
          {connexion.accesVerifieLe
            ? `Dernière vérification le ${jourDeLInstant(connexion.accesVerifieLe)}. Relaytour vérifie aussi chaque nuit.`
            : 'Aucune vérification pour l’instant. Relaytour vérifie aussi chaque nuit.'}
        </span>
      </div>
      {!AVEC_ANNUAIRE.has(connexion.fournisseur) && (
        <Alert
          type="info"
          showIcon
          title="Ce fournisseur ne publie pas d’annuaire des comptes."
          description="Relaytour compare les adresses des personnes à celles des droits du dossier. Une personne qui utilise une autre adresse chez le fournisseur paraît sans accès, et les membres d’un groupe ne se lisent pas."
        />
      )}
      {connexion.accesErreur && (
        <Alert type="warning" showIcon title={connexion.accesErreur} />
      )}
      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : error && !data ? (
        <Alert type="error" showIcon title={messageErreur(error)} />
      ) : verifications.length === 0 ? (
        <Empty description="Aucun dossier n’est lié à cette activité." />
      ) : (
        verifications.map(v => (
          <DossierVerifie
            key={v.dossier.id}
            v={v}
            gestion={connexion.portee === 'GESTION'}
            onActiverGestion={onActiverGestion}
          />
        ))
      )}
    </div>
  )
}
