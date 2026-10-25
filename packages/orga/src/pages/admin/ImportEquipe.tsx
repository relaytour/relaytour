import { useApolloClient, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, Button, Checkbox, Typography } from 'antd'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import AssistantTableur, {
  type ChampTableur,
  type LigneRapportTableur,
} from '../../composants/AssistantTableur'
import ChoixEdition from '../../composants/ChoixEdition'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { LigneEquipeImport } from '../../gql/graphql'
import { useActivite } from '../../lib/activite'
import {
  lignesDeEquipe,
  REGLES_EQUIPE,
  type ChampEquipe as Champ,
} from '../../lib/import-equipe'
import { EDITION_COURANTE, PREMIERS_PAS } from '../../lib/requetes'

// Import de l'équipe d'une période depuis un tableur (ADR 0049) : les personnes,
// leurs périmètres et le contact principal de chaque périmètre. Aucun mail ne part
// sans la case « Envoyer les invitations ».

const SIMULER = graphql(`
  query SimulerImportEquipe($editionId: ID!, $lignes: [LigneEquipeImport!]!) {
    simulerImportEquipe(editionId: $editionId, lignes: $lignes) {
      lignes {
        ligne
        etat
        raison
        avertissements
      }
      personnes
    }
  }
`)

const IMPORTER = graphql(`
  mutation ImporterEquipe(
    $editionId: ID!
    $lignes: [LigneEquipeImport!]!
    $envoyerMails: Boolean
  ) {
    importerEquipe(
      editionId: $editionId
      lignes: $lignes
      envoyerMails: $envoyerMails
    ) {
      lignes {
        ligne
        etat
        raison
        avertissements
      }
      personnes
      invitationsEnAttente
      affectationsCreees
      contactsPrincipaux
      mailsInvitations
      mailsEquipe
    }
  }
`)

interface Bilan {
  personnes: number
  affectations: number
  contacts: number
  enAttente: number
  mails: number
}

export default function ImportEquipe() {
  const { t } = useLingui()
  const client = useApolloClient()
  const navigate = useNavigate()
  const { lien } = useActivite()
  const { data: courante } = useQuery(EDITION_COURANTE)
  const [choixEdition, setChoixEdition] = useState<string>()
  const editionId = choixEdition ?? courante?.editionCourante?.id
  const [envoyer, setEnvoyer] = useState(false)
  const cumul = useRef<Bilan>({
    personnes: 0,
    affectations: 0,
    contacts: 0,
    enAttente: 0,
    mails: 0,
  })
  const [bilan, setBilan] = useState<Bilan>()

  const CHAMPS: ChampTableur<Champ>[] = useMemo(
    () => [
      { valeur: 'IGNORER', libelle: t`Ignorer` },
      { valeur: 'NOM_COMPLET', libelle: t`Prénom et nom` },
      { valeur: 'PRENOM', libelle: t`Prénom` },
      { valeur: 'NOM', libelle: t`Nom de famille` },
      { valeur: 'ADRESSE', libelle: t`Adresse mail`, obligatoire: true },
      { valeur: 'PERIMETRES', libelle: t`Périmètres (plusieurs par cellule)` },
      { valeur: 'CONTACT', libelle: t`Contact principal (oui ou non)` },
    ],
    [t]
  )

  const simuler = async (
    lignes: LigneEquipeImport[]
  ): Promise<LigneRapportTableur[]> => {
    const r = await client.query({
      query: SIMULER,
      variables: { editionId: editionId!, lignes },
      fetchPolicy: 'network-only',
    })
    return r.data?.simulerImportEquipe.lignes ?? []
  }
  const importer = async (
    lignes: LigneEquipeImport[]
  ): Promise<LigneRapportTableur[]> => {
    const r = await client.mutate({
      mutation: IMPORTER,
      variables: { editionId: editionId!, lignes, envoyerMails: envoyer },
      refetchQueries: [PREMIERS_PAS],
    })
    const rapport = r.data?.importerEquipe
    if (rapport) {
      const c = cumul.current
      cumul.current = {
        personnes: c.personnes + rapport.personnes,
        affectations: c.affectations + rapport.affectationsCreees,
        contacts: c.contacts + rapport.contactsPrincipaux,
        enAttente: c.enAttente + rapport.invitationsEnAttente,
        mails: c.mails + rapport.mailsInvitations + rapport.mailsEquipe,
      }
      setBilan(cumul.current)
    }
    return rapport?.lignes ?? []
  }

  const personnes = bilan?.personnes ?? 0
  const affectations = bilan?.affectations ?? 0
  const contacts = bilan?.contacts ?? 0
  const enAttente = bilan?.enAttente ?? 0
  const mails = bilan?.mails ?? 0

  return (
    <>
      <Titre
        sousTitre={t`Les personnes d’un tableur rejoignent l’équipe de l’activité, avec leurs périmètres. L’import ajoute sans rien retirer.`}
        actions={
          <Link to={lien('/admin/personnes')} className="rt-note">
            <Trans>← Personnes</Trans>
          </Link>
        }
      >
        <Trans>Importer l’équipe</Trans>
      </Titre>
      <AssistantTableur<Champ, LigneEquipeImport>
        champs={CHAMPS}
        regles={REGLES_EQUIPE}
        modele={{
          nom: t`modele-equipe.csv`,
          entetes: [
            t`Prénom`,
            t`Nom`,
            t`Adresse mail`,
            t`Périmètres`,
            t`Contact principal`,
          ],
          exemples: [
            [
              'Camille',
              'Martin',
              'camille.martin@exemple.org',
              t`Football, Logistique`,
              t`oui`,
            ],
            ['Alex', 'Durand', 'alex.durand@exemple.org', '', ''],
          ],
        }}
        construire={lignesDeEquipe}
        pret={editionId !== undefined}
        cleReglages={JSON.stringify([editionId])}
        reglages={
          <>
            <div className="rt-import-reglages">
              <ChoixEdition valeur={editionId} onChange={setChoixEdition} />
            </div>
            <Checkbox
              checked={envoyer}
              onChange={e => setEnvoyer(e.target.checked)}
            >
              <Trans>
                Envoyer les invitations et les mails d’équipe à la fin de
                l’import
              </Trans>
            </Checkbox>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              <Trans>
                Une personne sans périmètre rejoint l’équipe de l’activité. Les
                rôles d’admin se donnent ensuite depuis l’écran Personnes.
              </Trans>
            </Typography.Paragraph>
            {editionId === undefined && (
              <Alert
                type="warning"
                showIcon
                title={t`Choisissez une période.`}
              />
            )}
          </>
        }
        simuler={simuler}
        importer={importer}
        bilan={
          bilan && (
            <Typography.Paragraph>
              {t`Personnes invitées ou déjà membres : ${personnes}. Affectations créées : ${affectations}. Contacts principaux : ${contacts}. Invitations en attente d’accord : ${enAttente}. Mails mis en file : ${mails}.`}
            </Typography.Paragraph>
          )
        }
        suite={
          <Button
            type="primary"
            onClick={() => navigate(lien('/admin/equipe'))}
          >
            <Trans>Ouvrir l’écran Équipe</Trans>
          </Button>
        }
      />
    </>
  )
}
