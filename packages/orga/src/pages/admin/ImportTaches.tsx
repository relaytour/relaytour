import { useApolloClient, useQuery } from '@apollo/client/react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, Button, Checkbox, Select, Typography } from 'antd'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import AssistantTableur, {
  type ChampTableur,
  type LigneRapportTableur,
} from '../../composants/AssistantTableur'
import ChoixEdition from '../../composants/ChoixEdition'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { LigneTacheImport } from '../../gql/graphql'
import { useActivite } from '../../lib/activite'
import type { Tableau } from '../../lib/import-tableur'
import {
  lignesDeTaches,
  REGLES_TACHES,
  type ChampTache as Champ,
} from '../../lib/import-taches'
import { EDITION_COURANTE, PREMIERS_PAS } from '../../lib/requetes'

// Import des tâches d'une période depuis un tableur (ADR 0049). Le navigateur lit
// le fichier, l'admin associe les colonnes, le serveur vérifie chaque ligne, puis
// l'import s'écrit par lots. Les périmètres inconnus se créent dans un groupe
// choisi, ou leurs lignes sont écartées.

const SIMULER = graphql(`
  query SimulerImportTaches(
    $editionId: ID!
    $lignes: [LigneTacheImport!]!
    $groupeNouveaux: String
    $enregistrerTachesTypes: Boolean
  ) {
    simulerImportTaches(
      editionId: $editionId
      lignes: $lignes
      groupeNouveaux: $groupeNouveaux
      enregistrerTachesTypes: $enregistrerTachesTypes
    ) {
      lignes {
        ligne
        etat
        raison
        avertissements
      }
      perimetresCrees
      tachesTypesAjoutees
    }
  }
`)

const IMPORTER = graphql(`
  mutation ImporterTaches(
    $editionId: ID!
    $lignes: [LigneTacheImport!]!
    $groupeNouveaux: String
    $enregistrerTachesTypes: Boolean
  ) {
    importerTaches(
      editionId: $editionId
      lignes: $lignes
      groupeNouveaux: $groupeNouveaux
      enregistrerTachesTypes: $enregistrerTachesTypes
    ) {
      lignes {
        ligne
        etat
        raison
        avertissements
      }
      perimetresCrees
      tachesTypesAjoutees
    }
  }
`)
export default function ImportTaches() {
  const { t } = useLingui()
  const client = useApolloClient()
  const navigate = useNavigate()
  const { activite, lien, libelleGroupe } = useActivite()
  const { data: courante } = useQuery(EDITION_COURANTE)
  const [choixEdition, setChoixEdition] = useState<string>()
  const editionId = choixEdition ?? courante?.editionCourante?.id
  const [groupe, setGroupe] = useState<string | null>(null)
  const [tachesTypes, setTachesTypes] = useState(false)
  // Le bilan de l'import, cumulé lot après lot.
  const bilan = useRef({ perimetres: [] as string[], types: 0 })
  const [resume, setResume] = useState<{
    perimetres: string[]
    types: number
  }>()
  // Les périmètres que la vérification créerait, réunis sur tous les lots.
  const [aCreer, setACreer] = useState<string[]>([])

  const CHAMPS: ChampTableur<Champ>[] = useMemo(
    () => [
      { valeur: 'IGNORER', libelle: t`Ignorer` },
      { valeur: 'PERIMETRE', libelle: t`Périmètre`, obligatoire: true },
      { valeur: 'TITRE', libelle: t`Titre de la tâche`, obligatoire: true },
      { valeur: 'DESCRIPTION', libelle: t`Description` },
      { valeur: 'ECHEANCE', libelle: t`Échéance (date ou J-30)` },
      { valeur: 'FICHE', libelle: t`Fiche (titre ou identifiant)` },
      { valeur: 'RESPONSABLE', libelle: t`Responsable (adresse mail)` },
    ],
    [t]
  )

  const construire = useCallback(
    (tableau: Tableau, associations: readonly Champ[]) =>
      lignesDeTaches(tableau, associations),
    []
  )

  const variables = (lignes: LigneTacheImport[]) => ({
    editionId: editionId!,
    lignes,
    groupeNouveaux: groupe,
    enregistrerTachesTypes: tachesTypes,
  })
  const simuler = async (
    lignes: LigneTacheImport[]
  ): Promise<LigneRapportTableur[]> => {
    const r = await client.query({
      query: SIMULER,
      variables: variables(lignes),
      fetchPolicy: 'network-only',
    })
    const rapport = r.data?.simulerImportTaches
    if (rapport && rapport.perimetresCrees.length > 0) {
      setACreer(avant => [...new Set([...avant, ...rapport.perimetresCrees])])
    }
    return rapport?.lignes ?? []
  }
  const importer = async (
    lignes: LigneTacheImport[]
  ): Promise<LigneRapportTableur[]> => {
    const r = await client.mutate({
      mutation: IMPORTER,
      variables: variables(lignes),
      refetchQueries: [PREMIERS_PAS],
    })
    const rapport = r.data?.importerTaches
    if (rapport) {
      bilan.current = {
        perimetres: [...bilan.current.perimetres, ...rapport.perimetresCrees],
        types: bilan.current.types + rapport.tachesTypesAjoutees,
      }
      setResume(bilan.current)
    }
    return rapport?.lignes ?? []
  }

  const perimetresCrees = resume?.perimetres.join(', ') ?? ''
  const listeACreer = aCreer.join(', ')
  const typesAjoutes = resume?.types ?? 0

  return (
    <>
      <Titre
        sousTitre={t`Les tâches d’un tableur rejoignent une période. Une tâche déjà présente n’est pas recréée.`}
        actions={
          <Link to={lien('/retroplanning')} className="rt-note">
            <Trans>← Rétroplanning</Trans>
          </Link>
        }
      >
        <Trans>Importer des tâches</Trans>
      </Titre>
      <AssistantTableur<Champ, LigneTacheImport>
        champs={CHAMPS}
        regles={REGLES_TACHES}
        modele={{
          nom: t`modele-taches.csv`,
          entetes: [
            t`Périmètre`,
            t`Tâche`,
            t`Description`,
            t`Échéance`,
            t`Fiche`,
            t`Responsable`,
          ],
          exemples: [
            [
              t`Logistique`,
              t`Réserver les salles`,
              t`Vérifier les horaires d’ouverture.`,
              'J-90',
              '',
              'logistique@exemple.org',
            ],
            [t`Communication`, t`Annoncer les dates`, '', '2027-03-01', '', ''],
          ],
        }}
        construire={construire}
        pret={editionId !== undefined}
        cleReglages={JSON.stringify([editionId, groupe, tachesTypes])}
        reglages={
          <>
            <div className="rt-import-reglages">
              <ChoixEdition valeur={editionId} onChange={setChoixEdition} />
              <label className="rt-import-champ">
                <span className="rt-libelle">{t`Périmètres inconnus`}</span>
                <Select<string>
                  aria-label={t`Périmètres inconnus`}
                  style={{ minWidth: 260 }}
                  value={groupe ?? '__ecarter'}
                  onChange={v => setGroupe(v === '__ecarter' ? null : v)}
                  options={[
                    { value: '__ecarter', label: t`Écarter leurs lignes` },
                    ...activite.groupes.map(g => {
                      const nom = libelleGroupe(g.cle)
                      return { value: g.cle, label: t`Les créer : ${nom}` }
                    }),
                  ]}
                />
              </label>
            </div>
            <Checkbox
              checked={tachesTypes}
              onChange={e => setTachesTypes(e.target.checked)}
            >
              <Trans>
                Enregistrer aussi ces tâches comme tâches types de leur
                périmètre, pour les éditions suivantes
              </Trans>
            </Checkbox>
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
        onDebut={ecrire => {
          if (ecrire) {
            bilan.current = { perimetres: [], types: 0 }
            setResume(undefined)
          } else {
            setACreer([])
          }
        }}
        resumeVerification={
          aCreer.length > 0 && (
            <Alert
              type="info"
              showIcon
              title={t`Périmètres qui seront créés : ${listeACreer}.`}
              description={t`Vérifiez l’orthographe : un nom mal écrit créerait un périmètre de plus.`}
            />
          )
        }
        bilan={
          resume &&
          (resume.perimetres.length > 0 || typesAjoutes > 0) && (
            <Typography.Paragraph>
              {resume.perimetres.length > 0 &&
                t`Périmètres créés : ${perimetresCrees}. `}
              {typesAjoutes > 0 && t`Tâches types ajoutées : ${typesAjoutes}.`}
            </Typography.Paragraph>
          )
        }
        suite={
          <Button
            type="primary"
            onClick={() => navigate(lien('/retroplanning'))}
          >
            <Trans>Ouvrir le rétroplanning</Trans>
          </Button>
        }
      />
    </>
  )
}
