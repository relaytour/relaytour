import { InboxOutlined } from '@ant-design/icons'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Grid,
  Input,
  Progress,
  Radio,
  Result,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import ChoixEdition from '../composants/ChoixEdition'
import Titre from '../composants/Titre'
import type {
  PersonneImportInput,
  SimulerImportBenevolesQuery,
} from '../gql/graphql'
import { libelleJours } from '../lib/agenda'
import { useAgendasEcrits } from '../lib/agendas-ecrits'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import {
  associationSuffisante,
  choixDuFichier,
  construirePersonnes,
  csvDesEcartees,
  detecterColonnes,
  enLots,
  LIBELLES_CHAMP,
  lireFichier,
  proposerCible,
  VALEURS_NON_PAR_DEFAUT,
  type Champ,
  type Cible,
  type Colonne,
  type Feuille,
  type PersonneLue,
} from '../lib/import-benevoles'
import { EDITION_COURANTE, EDITIONS } from '../lib/requetes'
import {
  CORRESPONDANCES,
  ENREGISTRER_CORRESPONDANCE,
  IMPORTER,
  SEQUENCES_IMPORT,
  SIMULER_IMPORT,
} from '../lib/requetes-import'

// Assistant d'import d'une liste de bénévoles (ADR 0042), en cinq étapes : le
// fichier et la portée, les colonnes, les choix et les réglages, l'aperçu des
// doublons, puis l'écriture par lots. Le fichier se lit dans le navigateur et ne
// se garde nulle part ; seules les colonnes associées partent vers le serveur.

type Mode = 'A_REPARTIR' | 'PLACES_DIRECTES'
type Ligne =
  SimulerImportBenevolesQuery['simulerImportBenevoles']['lignes'][number]
type Decision = 'RATTACHER' | 'CREER'

const LIBELLES_NIVEAU = {
  FORT: { libelle: 'Même adresse', couleur: 'success' },
  MOYEN: { libelle: 'Même téléphone', couleur: 'warning' },
  FAIBLE: { libelle: 'Nom proche', couleur: 'default' },
} as const

const ETAPES = ['Fichier', 'Colonnes', 'Séquences', 'Aperçu', 'Rapport']

interface Bilan {
  aImporter: number
  dejaImportees: number
  ecartees: number
  fichesCreees: number
  fichesRattachees: number
  places: number
}

const BILAN_VIDE: Bilan = {
  aImporter: 0,
  dejaImportees: 0,
  ecartees: 0,
  fichesCreees: 0,
  fichesRattachees: 0,
  places: 0,
}

const additionner = (a: Bilan, b: Bilan): Bilan => ({
  aImporter: a.aImporter + b.aImporter,
  dejaImportees: a.dejaImportees + b.dejaImportees,
  ecartees: a.ecartees + b.ecartees,
  fichesCreees: a.fichesCreees + b.fichesCreees,
  fichesRattachees: a.fichesRattachees + b.fichesRattachees,
  places: a.places + b.places,
})

/** Un objet JSON lu du serveur, ou un objet vide. */
const objet = (valeur: unknown): Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
    ? (valeur as Record<string, unknown>)
    : {}

/** Télécharge un texte comme fichier, sans passer par le serveur. */
function telecharger(texte: string, nom: string) {
  const lien = URL.createObjectURL(
    new Blob([`\uFEFF${texte}`], { type: 'text/csv;charset=utf-8' })
  )
  const a = document.createElement('a')
  a.href = lien
  a.download = nom
  a.click()
  URL.revokeObjectURL(lien)
}

export default function ImportBenevoles() {
  const { activite, gere, lien, periode } = useActivite()
  const { message } = App.useApp()
  const client = useApolloClient()
  const naviguer = useNavigate()
  const { data: courante } = useQuery(EDITION_COURANTE)
  const { data: editions } = useQuery(EDITIONS)
  const [etape, setEtape] = useState(0)
  const ecrans = Grid.useBreakpoint()

  // Étape 1 : la période, la portée, la source et le fichier.
  const [editionChoisie, setEdition] = useState<string | undefined>()
  const editionId = editionChoisie ?? courante?.editionCourante?.id ?? undefined
  const edition = editions?.editions.find(e => e.id === editionId)
  const portees = useAgendasEcrits(editionId, 'Tout le programme')
  const [porteeChoisie, setPortee] = useState<string | null | undefined>()
  const perimetreId =
    porteeChoisie === undefined
      ? (portees[0]?.perimetreId ?? null)
      : porteeChoisie
  const [source, setSource] = useState('')
  const [feuilles, setFeuilles] = useState<Feuille[]>([])
  const [nomFeuille, setNomFeuille] = useState<string | null>(null)
  const [lecture, setLecture] = useState(false)
  const feuille = feuilles.find(f => f.nom === nomFeuille) ?? feuilles[0]
  const tableau = feuille?.tableau

  // Étape 2 : les colonnes.
  const [colonnes, setColonnes] = useState<Colonne[]>([])
  const champs = colonnes.map(c => c.champ)
  const { data: correspondances } = useQuery(CORRESPONDANCES, {
    variables: { activiteId: activite.id },
  })
  const [enregistrer, enregistrement] = useMutation(
    ENREGISTRER_CORRESPONDANCE,
    {
      refetchQueries: ['CorrespondancesImport'],
    }
  )
  const [nomCorrespondance, setNomCorrespondance] = useState('')

  // Étape 3 : les choix et les réglages.
  const { data: programme } = useQuery(SEQUENCES_IMPORT, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
  })
  const sequences = useMemo(
    () =>
      (programme?.programme ?? []).filter(
        s => perimetreId === null || s.perimetre?.id === perimetreId
      ),
    [programme, perimetreId]
  )
  const jours = useMemo(
    () => [...new Set((programme?.programme ?? []).map(s => s.jour))].sort(),
    [programme]
  )
  const [jour, setJour] = useState<string | null>(null)
  const jourRetenu = jour ?? jours[0] ?? edition?.debut ?? null
  const [valeursNon, setValeursNon] = useState(VALEURS_NON_PAR_DEFAUT)
  const [mode, setMode] = useState<Mode>('A_REPARTIR')
  const [accepterTout, setAccepterTout] = useState(false)
  const [prevenirParMail, setPrevenirParMail] = useState(true)
  // Les champs changent d'objet à chaque rendu : leur clé garde les calculs.
  const cleChamps = champs.join(',')
  const choix = useMemo(
    () => (tableau ? choixDuFichier(tableau, champs) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableau, cleChamps]
  )
  const [ciblesChoisies, setCibles] = useState<Map<string, Cible>>(new Map())
  const cibles = useMemo(
    () =>
      new Map(
        choix.map(c => [
          c.cle,
          ciblesChoisies.get(c.cle) ?? proposerCible(c, sequences, jourRetenu),
        ])
      ),
    [choix, ciblesChoisies, sequences, jourRetenu]
  )

  // Étape 4 : l'aperçu.
  const apercu = etape >= 3
  const lues = useMemo(
    () =>
      tableau && apercu
        ? construirePersonnes(tableau, champs, cibles, {
            valeursNon,
            jour: jourRetenu,
          })
        : { personnes: [] as PersonneLue[], ecartees: [] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableau, cleChamps, cibles, valeursNon, jourRetenu, apercu]
  )
  const [simulation, setSimulation] = useState<{
    bilan: Bilan
    lignes: Map<string, Ligne>
    depassements: SimulerImportBenevolesQuery['simulerImportBenevoles']['depassements']
    fichesRestantes: number
  } | null>(null)
  const [simulationEnCours, setSimulationEnCours] = useState(false)
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map())
  const [accord, setAccord] = useState(false)

  // Étape 5 : l'écriture.
  const [importer] = useMutation(IMPORTER, {
    refetchQueries: [
      'Benevoles',
      'Candidatures',
      'AppelsBenevoles',
      'BenevolesARepartir',
      'CouvertureProgramme',
      'Programme',
    ],
  })
  const [progression, setProgression] = useState(0)
  const [resultat, setResultat] = useState<Bilan | null>(null)

  const variablesCommunes = {
    editionId: editionId ?? '',
    perimetreId,
    source: source.trim(),
    mode,
    prevenirParMail,
    accepterTout: mode === 'A_REPARTIR' && accepterTout,
  }

  const versSaisie = (p: PersonneLue): PersonneImportInput => {
    const ligne = simulation?.lignes.get(p.cle)
    const niveau = ligne?.rapprochement?.niveau
    const decision =
      decisions.get(p.cle) ?? (niveau === 'FORT' ? 'RATTACHER' : 'CREER')
    return {
      cle: p.cle,
      nom: p.nom,
      courriel: p.courriel,
      telephone: p.telephone,
      precisions: p.precisions,
      refExterne: p.refExterne,
      accordLe: p.accordLe,
      plages: p.plages,
      sequenceIds: p.sequenceIds,
      ...(ligne?.rapprochement && decision === 'RATTACHER'
        ? { rattachement: ligne.rapprochement.benevoleId }
        : {}),
      ...(niveau === 'FORT' && decision === 'CREER'
        ? { nouvelleFiche: true }
        : {}),
    }
  }

  const lire = async (fichier: File) => {
    setLecture(true)
    try {
      const lus = await lireFichier(fichier)
      setFeuilles(lus)
      setNomFeuille(lus[0]?.nom ?? null)
      if (source.trim() === '') setSource(fichier.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      message.error((e as Error).message)
    } finally {
      setLecture(false)
    }
  }

  const versColonnes = () => {
    if (!tableau) return
    const detectees = detecterColonnes(tableau)
    // Une correspondance aux mêmes en-têtes se propose d'office.
    const memes = correspondances?.correspondancesImport.find(
      c => c.entetes.join('\u0000') === tableau.entetes.join('\u0000')
    )
    setColonnes(memes ? appliquer(detectees, memes.associations) : detectees)
    if (memes) {
      setNomCorrespondance(memes.nom)
      appliquerReglages(memes.reglages)
      message.info(`La correspondance « ${memes.nom} » s’applique.`)
    }
    setEtape(1)
  }

  const appliquer = (detectees: Colonne[], brutes: unknown): Colonne[] => {
    const associations = objet(brutes)
    return detectees.map(c => {
      const champ = associations[c.entete]
      return !c.sensible && typeof champ === 'string' && champ in LIBELLES_CHAMP
        ? { ...c, champ: champ as Champ, confiance: 'HAUTE' }
        : c
    })
  }

  const appliquerReglages = (bruts: unknown) => {
    const reglages = objet(bruts)
    if (Array.isArray(reglages.valeursNon)) {
      setValeursNon(reglages.valeursNon.filter(v => typeof v === 'string'))
    }
    if (reglages.mode === 'A_REPARTIR' || reglages.mode === 'PLACES_DIRECTES') {
      setMode(reglages.mode)
    }
    if (typeof reglages.prevenirParMail === 'boolean') {
      setPrevenirParMail(reglages.prevenirParMail)
    }
  }

  const enregistrerCorrespondance = async () => {
    if (!tableau) return
    try {
      await enregistrer({
        variables: {
          activiteId: activite.id,
          nom: nomCorrespondance.trim(),
          entetes: tableau.entetes,
          // Une correspondance ne garde que les colonnes associées et les
          // réglages : aucune donnée du fichier, aucune séquence.
          associations: Object.fromEntries(
            colonnes
              .filter(c => c.champ !== 'IGNORER')
              .map(c => [c.entete, c.champ])
          ),
          reglages: { valeursNon, mode, prevenirParMail },
        },
      })
      message.success('Correspondance enregistrée.')
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const simuler = async () => {
    setSimulationEnCours(true)
    try {
      let bilan = BILAN_VIDE
      const lignes = new Map<string, Ligne>()
      let depassements: SimulerImportBenevolesQuery['simulerImportBenevoles']['depassements'] =
        []
      let fichesRestantes = 0
      for (const lot of enLots(lues.personnes)) {
        const { data } = await client.query({
          query: SIMULER_IMPORT,
          variables: {
            ...variablesCommunes,
            accord: true,
            personnes: lot.map(versSaisie),
          },
          fetchPolicy: 'no-cache',
        })
        const rapport = data!.simulerImportBenevoles
        bilan = additionner(bilan, rapport)
        for (const l of rapport.lignes) lignes.set(l.cle, l)
        depassements = [...depassements, ...rapport.depassements]
        fichesRestantes = rapport.fichesRestantes
      }
      setSimulation({ bilan, lignes, depassements, fichesRestantes })
    } catch (e) {
      message.error(messageErreur(e))
    } finally {
      setSimulationEnCours(false)
    }
  }

  const lancer = async () => {
    setEtape(4)
    setProgression(0)
    let bilan = BILAN_VIDE
    const lots = enLots(lues.personnes)
    try {
      for (const [i, lot] of lots.entries()) {
        const { data } = await importer({
          variables: {
            ...variablesCommunes,
            accord,
            personnes: lot.map(versSaisie),
          },
        })
        bilan = additionner(bilan, data!.importerBenevoles)
        setProgression(Math.round(((i + 1) / lots.length) * 100))
      }
      setResultat(bilan)
    } catch (e) {
      message.error(messageErreur(e))
      setResultat(bilan)
    }
  }

  // Les lignes écartées, par le navigateur ou par le serveur, avec leur motif.
  const ecarteesToutes = useMemo(() => {
    if (!tableau) return []
    const serveur = [...(simulation?.lignes.values() ?? [])].filter(
      l => l.etat === 'ECARTEE'
    )
    const parCle = new Map(lues.personnes.map(p => [p.cle, p]))
    return [
      ...lues.ecartees,
      ...serveur.flatMap(l => {
        const p = parCle.get(l.cle)
        return p
          ? p.lignes.map(numero => ({
              ligne: numero,
              motif: l.motif ?? 'Ligne écartée par le serveur.',
              valeurs: tableau.lignes[numero - 2] ?? [],
            }))
          : []
      }),
    ].sort((a, b) => a.ligne - b.ligne)
  }, [tableau, simulation, lues])

  const telechargerEcartees = async () => {
    if (!tableau) return
    telecharger(
      await csvDesEcartees(tableau.entetes, ecarteesToutes),
      'lignes-ecartees.csv'
    )
  }

  const optionsCible = [
    { value: 'IGNORER', label: 'Ignorer' },
    { value: 'PLAGE', label: 'Disponibilité seulement' },
    ...sequences.map(s => ({
      value: s.id,
      label: `${s.titre} · ${libelleJours(s.jour)}, ${s.heureDebut} → ${s.heureFin}`,
    })),
  ]
  const valeurCible = (c: Cible) =>
    c.type === 'SEQUENCE' ? c.sequenceId : c.type
  const versCible = (valeur: string): Cible =>
    valeur === 'IGNORER' || valeur === 'PLAGE'
      ? { type: valeur }
      : { type: 'SEQUENCE', sequenceId: valeur }

  const rapprochees = lues.personnes.filter(
    p => simulation?.lignes.get(p.cle)?.rapprochement
  )
  const comptes = lues.personnes.filter(
    p => simulation?.lignes.get(p.cle)?.compte
  )
  const placesDirectesSansSequence =
    mode === 'PLACES_DIRECTES' &&
    !lues.personnes.some(p => p.sequenceIds.length > 0)

  return (
    <>
      <Titre
        sousTitre="Faites entrer une liste tenue hors de Relaytour : un export de billetterie, un formulaire, un tableur. Le fichier reste sur votre appareil."
        avant={
          <Link to={lien('/benevoles')} className="rt-note">
            ← Bénévoles
          </Link>
        }
      >
        Importer une liste de bénévoles
      </Titre>
      {ecrans.md ? (
        <Steps
          current={etape}
          size="small"
          items={ETAPES.map(title => ({ title }))}
          style={{ marginBottom: 24 }}
        />
      ) : (
        <p className="rt-note">
          Étape {etape + 1} sur {ETAPES.length} : {ETAPES[etape]}
        </p>
      )}

      {etape === 0 && (
        <section className="rt-verre rt-import-etape">
          <div className="rt-import-reglages">
            <ChoixEdition
              valeur={editionId}
              onChange={id => {
                setEdition(id)
                setPortee(undefined)
              }}
            />
            <label className="rt-import-champ">
              <span className="rt-libelle">Portée</span>
              <Select
                aria-label="Portée de l’import"
                style={{ minWidth: 220 }}
                value={perimetreId ?? '__programme'}
                onChange={v => setPortee(v === '__programme' ? null : v)}
                options={portees.map(p => ({
                  value: p.perimetreId ?? '__programme',
                  label: p.nom,
                }))}
              />
            </label>
            <label className="rt-import-champ">
              <span className="rt-libelle">Source</span>
              <Input
                aria-label="Source de la liste"
                placeholder="Billetterie du 7 août"
                maxLength={120}
                value={source}
                onChange={e => setSource(e.target.value)}
              />
            </label>
          </div>
          {portees.length === 0 && (
            <Alert
              type="warning"
              showIcon
              title={`Vous n’écrivez dans aucun périmètre de ${periode.cette}.`}
            />
          )}
          <Upload.Dragger
            accept=".csv,.txt,.xlsx"
            maxCount={1}
            showUploadList={false}
            beforeUpload={fichier => {
              void lire(fichier)
              return false
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p>
              Déposez un fichier CSV ou Excel (.xlsx), ou cliquez pour le
              choisir.
            </p>
            <p className="rt-note">
              2 Mo, 5 000 lignes et 200 colonnes au plus.
            </p>
          </Upload.Dragger>
          {feuilles.length > 1 && (
            <label className="rt-import-champ">
              <span className="rt-libelle">Feuille</span>
              <Select
                aria-label="Feuille du classeur"
                value={feuille?.nom}
                onChange={setNomFeuille}
                options={feuilles.map(f => ({ value: f.nom, label: f.nom }))}
              />
            </label>
          )}
          {tableau && (
            <p className="rt-note">
              {tableau.lignes.length} lignes et {tableau.entetes.length}{' '}
              colonnes lues.
            </p>
          )}
          <Space>
            <Button
              type="primary"
              disabled={
                !tableau || source.trim() === '' || portees.length === 0
              }
              loading={lecture}
              onClick={versColonnes}
            >
              Associer les colonnes
            </Button>
          </Space>
        </section>
      )}

      {etape === 1 && tableau && (
        <section className="rt-verre rt-import-etape">
          <p>
            Relaytour propose un champ pour chaque colonne, d’après son en-tête
            et son contenu. Corrigez au besoin. Une colonne ignorée ne quitte
            pas votre appareil.
          </p>
          <ul className="rt-import-colonnes">
            {colonnes.map(c => (
              <li key={c.index} className="rt-import-colonne">
                <div>
                  <strong>{c.entete}</strong>
                  <span className="rt-note">
                    {c.exemples.length > 0
                      ? c.exemples.join(' · ')
                      : 'Colonne vide'}
                  </span>
                </div>
                <Select
                  aria-label={`Champ de la colonne ${c.entete}`}
                  style={{ minWidth: 260 }}
                  value={c.champ}
                  disabled={c.sensible}
                  onChange={champ =>
                    setColonnes(
                      colonnes.map(x =>
                        x === c ? { ...x, champ, confiance: 'HAUTE' } : x
                      )
                    )
                  }
                  options={(Object.keys(LIBELLES_CHAMP) as Champ[]).map(
                    champ => ({
                      value: champ,
                      label: LIBELLES_CHAMP[champ],
                    })
                  )}
                />
                {c.sensible ? (
                  <Tag>Donnée sensible : ignorée</Tag>
                ) : c.champ !== 'IGNORER' && c.confiance !== 'HAUTE' ? (
                  <Tag color="warning">À vérifier</Tag>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="rt-import-reglages">
            <Input
              aria-label="Nom de la correspondance"
              placeholder="Nom de la correspondance, par exemple « Billetterie »"
              style={{ maxWidth: 320 }}
              value={nomCorrespondance}
              onChange={e => setNomCorrespondance(e.target.value)}
            />
            <Button
              disabled={nomCorrespondance.trim() === ''}
              loading={enregistrement.loading}
              onClick={() => void enregistrerCorrespondance()}
            >
              Enregistrer la correspondance
            </Button>
            {(correspondances?.correspondancesImport.length ?? 0) > 0 && (
              <Select
                aria-label="Appliquer une correspondance"
                placeholder="Appliquer une correspondance"
                style={{ minWidth: 240 }}
                value={null}
                onChange={id => {
                  const c = correspondances!.correspondancesImport.find(
                    x => x.id === id
                  )
                  if (!c) return
                  setColonnes(appliquer(colonnes, c.associations))
                  appliquerReglages(c.reglages)
                  setNomCorrespondance(c.nom)
                }}
                options={correspondances!.correspondancesImport.map(c => ({
                  value: c.id,
                  label: c.nom,
                }))}
              />
            )}
          </div>
          {!associationSuffisante(champs) && (
            <Alert
              type="warning"
              showIcon
              title="Associez au moins un nom, une adresse ou un téléphone."
            />
          )}
          <Space>
            <Button onClick={() => setEtape(0)}>Précédent</Button>
            <Button
              type="primary"
              disabled={!associationSuffisante(champs)}
              onClick={() => setEtape(2)}
            >
              Associer les séquences
            </Button>
          </Space>
        </section>
      )}

      {etape === 2 && tableau && (
        <section className="rt-verre rt-import-etape">
          <div className="rt-import-reglages">
            <label className="rt-import-champ">
              <span className="rt-libelle">Jour des horaires sans jour</span>
              <Select
                aria-label="Jour des horaires sans jour"
                style={{ minWidth: 200 }}
                value={jourRetenu}
                onChange={setJour}
                options={jours.map(j => ({ value: j, label: libelleJours(j) }))}
              />
            </label>
            <label className="rt-import-champ">
              <span className="rt-libelle">Valeurs qui signifient « non »</span>
              <Select
                aria-label="Valeurs qui signifient non"
                mode="tags"
                style={{ minWidth: 260 }}
                value={valeursNon}
                onChange={setValeursNon}
              />
            </label>
          </div>
          {choix.length === 0 ? (
            <p className="rt-note">
              Aucune colonne ne porte de poste ni de créneau. Les personnes
              rejoindront les bénévoles à répartir, avec leurs précisions.
            </p>
          ) : (
            <ul className="rt-import-colonnes">
              {choix.map(c => (
                <li key={c.cle} className="rt-import-colonne">
                  <div>
                    <strong>{c.libelle}</strong>
                    {c.horaire && (
                      <span className="rt-note">
                        {c.horaire.heureDebut} → {c.horaire.heureFin}
                      </span>
                    )}
                  </div>
                  <Select
                    aria-label={`Séquence de ${c.libelle}`}
                    style={{ minWidth: 320, maxWidth: '100%' }}
                    showSearch={{ optionFilterProp: 'label' }}
                    value={valeurCible(cibles.get(c.cle)!)}
                    onChange={v =>
                      setCibles(
                        new Map(ciblesChoisies).set(c.cle, versCible(v))
                      )
                    }
                    options={optionsCible}
                  />
                </li>
              ))}
            </ul>
          )}
          <Radio.Group
            value={mode}
            onChange={e => setMode(e.target.value as Mode)}
            className="rt-import-mode"
          >
            <Radio value="A_REPARTIR">
              À répartir : chaque personne devient une candidature à traiter.
            </Radio>
            <Radio value="PLACES_DIRECTES">
              Places directes : chaque personne reçoit sa fiche et ses places.
            </Radio>
          </Radio.Group>
          {mode === 'A_REPARTIR' && (
            <Checkbox
              checked={accepterTout}
              onChange={e => setAccepterTout(e.target.checked)}
            >
              Accepter tout : les séquences associées sont acceptées dès
              l’import.
            </Checkbox>
          )}
          <Checkbox
            checked={prevenirParMail}
            onChange={e => setPrevenirParMail(e.target.checked)}
          >
            Prévenir par mail : la première place d’une personne lui envoie son
            lien personnel.
          </Checkbox>
          <Space>
            <Button onClick={() => setEtape(1)}>Précédent</Button>
            <Button
              type="primary"
              onClick={() => {
                setSimulation(null)
                setDecisions(new Map())
                setEtape(3)
              }}
            >
              Voir l’aperçu
            </Button>
          </Space>
        </section>
      )}

      {etape === 3 && tableau && (
        <section className="rt-verre rt-import-etape">
          <p>
            {lues.personnes.length} personne
            {lues.personnes.length > 1 ? 's' : ''}, {lues.ecartees.length} ligne
            {lues.ecartees.length > 1 ? 's' : ''} écartée
            {lues.ecartees.length > 1 ? 's' : ''}.
          </p>
          {placesDirectesSansSequence && (
            <Alert
              type="warning"
              showIcon
              title="Le mode « places directes » exige au moins une colonne associée à une séquence."
            />
          )}
          {!simulation ? (
            <Button
              type="primary"
              loading={simulationEnCours}
              disabled={
                lues.personnes.length === 0 || placesDirectesSansSequence
              }
              onClick={() => void simuler()}
            >
              Vérifier la liste
            </Button>
          ) : (
            <>
              <ul className="rt-import-bilan">
                <li>{simulation.bilan.aImporter} à importer</li>
                <li>{simulation.bilan.dejaImportees} déjà importées</li>
                <li>
                  {simulation.bilan.ecartees + lues.ecartees.length} écartées
                </li>
                <li>{simulation.bilan.fichesCreees} fiches créées</li>
                <li>{simulation.bilan.fichesRattachees} fiches rejointes</li>
                <li>{simulation.bilan.places} places</li>
              </ul>
              {simulation.bilan.fichesCreees > simulation.fichesRestantes && (
                <Alert
                  type="error"
                  showIcon
                  title={`L’activité peut encore recevoir ${simulation.fichesRestantes} fiches : réduisez la liste.`}
                />
              )}
              {simulation.depassements.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  title="Des séquences dépassent leurs renforts recherchés."
                  description={simulation.depassements
                    .map(d => `${d.titre} : ${d.renforts} pour ${d.besoin}`)
                    .join(' · ')}
                />
              )}
              {rapprochees.length > 0 && (
                <>
                  <h2 className="rt-intertitre">Fiches proches</h2>
                  <ul className="rt-import-colonnes">
                    {rapprochees.map(p => {
                      const r = simulation.lignes.get(p.cle)!.rapprochement!
                      const niveau = LIBELLES_NIVEAU[r.niveau]
                      const decision =
                        decisions.get(p.cle) ??
                        (r.niveau === 'FORT' ? 'RATTACHER' : 'CREER')
                      return (
                        <li key={p.cle} className="rt-import-colonne">
                          <div>
                            <strong>{p.nom}</strong>
                            <span className="rt-note">
                              Ligne {p.lignes.join(', ')} · fiche « {r.nom} »
                            </span>
                          </div>
                          <Tag color={niveau.couleur}>{niveau.libelle}</Tag>
                          <Radio.Group
                            value={decision}
                            onChange={e =>
                              setDecisions(
                                new Map(decisions).set(
                                  p.cle,
                                  e.target.value as Decision
                                )
                              )
                            }
                          >
                            <Radio value="RATTACHER">
                              Rejoindre « {r.nom} »
                            </Radio>
                            <Radio value="CREER">Créer une fiche</Radio>
                          </Radio.Group>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
              {gere && comptes.length > 0 && (
                <Alert
                  type="info"
                  showIcon
                  title={`${comptes.length} adresse${comptes.length > 1 ? 's sont celles' : ' est celle'} d’un compte de l’organisation.`}
                  description={comptes.map(p => p.nom).join(', ')}
                />
              )}
              {ecarteesToutes.length > 0 && (
                <>
                  <h2 className="rt-intertitre">Lignes écartées</h2>
                  <ul className="rt-import-ecartees">
                    {ecarteesToutes.slice(0, 50).map(e => (
                      <li key={`${e.ligne}-${e.motif}`}>
                        <strong>Ligne {e.ligne}</strong> · {e.motif}
                      </li>
                    ))}
                  </ul>
                  {ecarteesToutes.length > 50 && (
                    <p className="rt-note">
                      Et {ecarteesToutes.length - 50} autres lignes, dans le
                      fichier à télécharger.
                    </p>
                  )}
                  <Button onClick={() => void telechargerEcartees()}>
                    Télécharger les lignes écartées
                  </Button>
                </>
              )}
              <Checkbox
                checked={accord}
                onChange={e => setAccord(e.target.checked)}
              >
                Les personnes de cette liste ont accepté que leurs coordonnées
                soient enregistrées pour organiser l’activité.
              </Checkbox>
            </>
          )}
          <Space>
            <Button onClick={() => setEtape(2)}>Précédent</Button>
            <Button
              type="primary"
              disabled={
                !simulation ||
                !accord ||
                simulation.bilan.aImporter === 0 ||
                simulation.bilan.fichesCreees > simulation.fichesRestantes
              }
              onClick={() => void lancer()}
            >
              Importer
            </Button>
          </Space>
        </section>
      )}

      {etape === 4 && (
        <section className="rt-verre rt-import-etape">
          {resultat === null ? (
            <>
              <p>Import en cours…</p>
              <Progress percent={progression} />
            </>
          ) : (
            <Result
              status="success"
              title={`${resultat.aImporter} personne${resultat.aImporter > 1 ? 's' : ''} importée${resultat.aImporter > 1 ? 's' : ''}.`}
              subTitle={`${resultat.fichesCreees} fiches créées, ${resultat.fichesRattachees} fiches rejointes, ${resultat.places} places, ${resultat.dejaImportees} déjà importées.`}
              extra={[
                <Button
                  key="candidatures"
                  type="primary"
                  onClick={() =>
                    void naviguer(lien('/benevoles?onglet=candidatures'))
                  }
                >
                  Voir les candidatures
                </Button>,
                <Button
                  key="repartition"
                  onClick={() =>
                    void naviguer(lien('/programme?vue=repartition'))
                  }
                >
                  Répartir dans le programme
                </Button>,
              ]}
            />
          )}
          <Typography.Paragraph className="rt-note">
            Aucun mail ne part à l’import. La première place d’une personne
            joignable lui envoie son lien personnel.
          </Typography.Paragraph>
        </section>
      )}
    </>
  )
}
