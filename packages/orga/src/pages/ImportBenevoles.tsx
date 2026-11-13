import { InboxOutlined } from '@ant-design/icons'
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
  champUnique,
  choixDuFichier,
  construirePersonnes,
  csvDesEcartees,
  detecterColonnes,
  enLots,
  LIBELLES_CHAMP,
  lireFichier,
  proposerCible,
  proposerRemplacements,
  VALEURS_ANNULEES_PAR_DEFAUT,
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
  REFS_IMPORTEES,
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

/** Le nom d'un champ qu'une mise à jour garde en conflit. */
const LIBELLES_CHAMP_IMPORT: Record<
  'COURRIEL' | 'TELEPHONE' | 'PRECISIONS' | 'PLAGES' | 'SEQUENCES',
  MessageDescriptor
> = {
  COURRIEL: msg({
    message: 'adresse',
    comment:
      'Champ d’une fiche bénévole dont la valeur diffère du fichier importé',
  }),
  TELEPHONE: msg({
    message: 'téléphone',
    comment:
      'Champ d’une fiche bénévole dont la valeur diffère du fichier importé',
  }),
  PRECISIONS: msg({
    message: 'précisions de disponibilité',
    comment:
      'Champ d’une fiche bénévole dont la valeur diffère du fichier importé',
  }),
  PLAGES: msg({
    message: 'disponibilités',
    comment:
      'Champ d’une fiche bénévole dont la valeur diffère du fichier importé',
  }),
  SEQUENCES: msg({
    message: 'séquences',
    comment:
      'Champ d’une fiche bénévole dont la valeur diffère du fichier importé',
  }),
}

const LIBELLES_NIVEAU: Record<
  'FORT' | 'MOYEN' | 'FAIBLE',
  { libelle: MessageDescriptor; couleur: string }
> = {
  FORT: {
    libelle: msg({
      message: 'Même adresse',
      comment:
        'Raison pour laquelle deux fiches bénévoles semblent identiques : même adresse de courriel',
    }),
    couleur: 'success',
  },
  MOYEN: {
    libelle: msg({
      message: 'Même téléphone',
      comment: 'Raison pour laquelle deux fiches bénévoles semblent identiques',
    }),
    couleur: 'warning',
  },
  FAIBLE: {
    libelle: msg({
      message: 'Nom proche',
      comment: 'Raison pour laquelle deux fiches bénévoles semblent identiques',
    }),
    couleur: 'default',
  },
}

const ETAPES: MessageDescriptor[] = [
  msg({
    message: 'Fichier',
    comment: 'Première étape de l’assistant d’import de bénévoles',
  }),
  msg({
    message: 'Colonnes',
    comment: 'Deuxième étape de l’assistant d’import de bénévoles',
  }),
  msg({
    message: 'Séquences',
    comment: 'Troisième étape de l’assistant d’import de bénévoles',
  }),
  msg({
    message: 'Aperçu',
    comment: 'Quatrième étape de l’assistant d’import de bénévoles',
  }),
  msg({
    message: 'Rapport',
    comment: 'Dernière étape de l’assistant d’import de bénévoles',
  }),
]

interface Bilan {
  aImporter: number
  dejaImportees: number
  misesAJour: number
  conflits: number
  annulees: number
  placesRetirees: number
  ecartees: number
  fichesCreees: number
  fichesRattachees: number
  places: number
}

const BILAN_VIDE: Bilan = {
  aImporter: 0,
  dejaImportees: 0,
  misesAJour: 0,
  conflits: 0,
  annulees: 0,
  placesRetirees: 0,
  ecartees: 0,
  fichesCreees: 0,
  fichesRattachees: 0,
  places: 0,
}

const additionner = (a: Bilan, b: Bilan): Bilan => ({
  aImporter: a.aImporter + b.aImporter,
  dejaImportees: a.dejaImportees + b.dejaImportees,
  misesAJour: a.misesAJour + b.misesAJour,
  conflits: a.conflits + b.conflits,
  annulees: a.annulees + b.annulees,
  placesRetirees: a.placesRetirees + b.placesRetirees,
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
  // Certains navigateurs lancent le téléchargement après le clic : le lien vit
  // encore une minute.
  setTimeout(() => URL.revokeObjectURL(lien), 60_000)
}

export default function ImportBenevoles() {
  const { t } = useLingui()
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
  const portees = useAgendasEcrits(editionId, t`Tout le programme`)
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
  const [valeursAnnulees, setValeursAnnulees] = useState(
    VALEURS_ANNULEES_PAR_DEFAUT
  )
  const [mode, setMode] = useState<Mode>('A_REPARTIR')
  const [accepterTout, setAccepterTout] = useState(false)
  const [prevenirParMail, setPrevenirParMail] = useState(true)
  const [mettreAJour, setMettreAJour] = useState(false)
  const [retirerPlacesAnnulees, setRetirerPlacesAnnulees] = useState(false)
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
            valeursAnnulees,
          })
        : { personnes: [] as PersonneLue[], ecartees: [] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      tableau,
      cleChamps,
      cibles,
      valeursNon,
      valeursAnnulees,
      jourRetenu,
      apercu,
    ]
  )
  const [simulation, setSimulation] = useState<{
    bilan: Bilan
    lignes: Map<string, Ligne>
    depassements: SimulerImportBenevolesQuery['simulerImportBenevoles']['depassements']
    fichesRestantes: number
  } | null>(null)
  const [simulationEnCours, setSimulationEnCours] = useState(false)
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map())
  // Par nouveau billet : vrai s'il remplace le billet annulé proposé.
  const [decisionsRemplacement, setDecisionsRemplacement] = useState<
    Map<string, boolean>
  >(new Map())
  // Les identifiants déjà importés de la source, relus après la vérification.
  const [refsDeLaSource, setRefsDeLaSource] = useState<string[] | null>(null)
  const [accord, setAccord] = useState(false)

  // Étape 5 : l'écriture.
  // Les écrans se relisent une fois, après le dernier lot.
  const [importer] = useMutation(IMPORTER)
  const [progression, setProgression] = useState(0)
  const [resultat, setResultat] = useState<Bilan | null>(null)
  // Un lot en échec arrête l'import : le rapport dit combien de personnes
  // restent à traiter, et pourquoi.
  const [echec, setEchec] = useState<{
    motif: string
    restantes: number
  } | null>(null)

  /** Oublie les choix qui dépendent de la période, de la portée ou du fichier. */
  const oublierChoix = () => {
    setCibles(new Map())
    setDecisions(new Map())
    setSimulation(null)
  }

  const variablesCommunes = {
    editionId: editionId ?? '',
    perimetreId,
    source: source.trim(),
    mode,
    prevenirParMail,
    accepterTout: mode === 'A_REPARTIR' && accepterTout,
    mettreAJour: gere && mettreAJour,
    retirerPlacesAnnulees:
      gere && mettreAJour && champs.includes('ANNULATION')
        ? retirerPlacesAnnulees
        : false,
  }

  // Les billets annulés partent en dernier : les billets qui les remplacent
  // acceptent d'abord leurs séquences, et ces places restent.
  const aEnvoyer = useMemo(
    () => [
      ...lues.personnes.filter(p => !p.annulee),
      ...lues.personnes.filter(p => p.annulee),
    ],
    [lues]
  )

  // Les billets annulés qu'un nouveau billet du fichier remplace sans doute,
  // parmi ceux qui ont une fiche : par clé du nouveau billet.
  const remplacements = useMemo(() => {
    const proposes = new Map<string, PersonneLue>()
    if (!simulation || !(gere && mettreAJour)) return proposes
    const etat = (p: PersonneLue) => simulation.lignes.get(p.cle)
    const nouveaux = new Set(
      lues.personnes
        .filter(
          p =>
            !p.annulee &&
            p.refExterne !== null &&
            etat(p)?.etat === 'A_IMPORTER'
        )
        .map(p => p.cle)
    )
    const surFiche = lues.personnes.filter(
      p => !p.annulee || (etat(p)?.etat === 'ANNULEE' && etat(p)?.rattacheeA)
    )
    const parCle = new Map(lues.personnes.map(p => [p.cle, p] as const))
    for (const [nouveau, annule] of proposerRemplacements(surFiche, nouveaux)) {
      proposes.set(nouveau, parCle.get(annule)!)
    }
    return proposes
  }, [simulation, gere, mettreAJour, lues])
  const remplace = (cle: string) =>
    remplacements.has(cle) && (decisionsRemplacement.get(cle) ?? true)

  const versSaisie = (p: PersonneLue): PersonneImportInput => {
    const ligne = simulation?.lignes.get(p.cle)
    const niveau = ligne?.rapprochement?.niveau
    const decision =
      decisions.get(p.cle) ?? (niveau === 'FORT' ? 'RATTACHER' : 'CREER')
    if (p.annulee) {
      return { cle: p.cle, nom: p.nom, refExterne: p.refExterne, annulee: true }
    }
    // Un billet qui en remplace un autre rejoint la fiche du billet annulé.
    const annule = remplace(p.cle) ? remplacements.get(p.cle) : undefined
    const ficheDuBillet = annule
      ? simulation?.lignes.get(annule.cle)?.rattacheeA
      : null
    if (ficheDuBillet) {
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
        rattachement: ficheDuBillet,
        remplace: true,
      }
    }
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
      oublierChoix()
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
      const nomCorrespondanceAppliquee = memes.nom
      message.info(
        t`La correspondance « ${nomCorrespondanceAppliquee} » s’applique.`
      )
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
    if (Array.isArray(reglages.valeursAnnulees)) {
      setValeursAnnulees(
        reglages.valeursAnnulees.filter(v => typeof v === 'string')
      )
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
          reglages: { valeursNon, valeursAnnulees, mode, prevenirParMail },
        },
      })
      message.success(t`Correspondance enregistrée.`)
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
      for (const lot of enLots(aEnvoyer)) {
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
      setDecisionsRemplacement(new Map())
      // Les billets déjà importés que le fichier ne contient plus : signalés,
      // jamais modifiés. Un export filtré n'annule rien.
      if (champs.includes('REF_EXTERNE')) {
        const { data } = await client.query({
          query: REFS_IMPORTEES,
          variables: {
            editionId: variablesCommunes.editionId,
            perimetreId: variablesCommunes.perimetreId,
            source: variablesCommunes.source,
          },
          fetchPolicy: 'no-cache',
        })
        setRefsDeLaSource(data?.refsImportees ?? [])
      } else {
        setRefsDeLaSource(null)
      }
    } catch (e) {
      message.error(messageErreur(e))
    } finally {
      setSimulationEnCours(false)
    }
  }

  const lancer = async () => {
    setEtape(4)
    setProgression(0)
    setEchec(null)
    let bilan = BILAN_VIDE
    let traitees = 0
    const lots = enLots(aEnvoyer)
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
        traitees += lot.length
        setProgression(Math.round(((i + 1) / lots.length) * 100))
      }
    } catch (e) {
      setEchec({
        motif: messageErreur(e),
        restantes: lues.personnes.length - traitees,
      })
    }
    setResultat(bilan)
    await client.refetchQueries({
      include: [
        'Benevoles',
        'Candidatures',
        'AppelsBenevoles',
        'BenevolesARepartir',
        'CouvertureProgramme',
        'Programme',
        'DoublonsBenevoles',
      ],
    })
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
              motif: l.motif ?? t`Ligne écartée par le serveur.`,
              valeurs: tableau.lignes[numero - 2] ?? [],
            }))
          : []
      }),
    ].sort((a, b) => a.ligne - b.ligne)
  }, [tableau, simulation, lues, t])

  const telechargerEcartees = async () => {
    if (!tableau) return
    telecharger(
      await csvDesEcartees(
        tableau.entetes,
        ecarteesToutes,
        tableau.separateur ?? ';'
      ),
      'lignes-ecartees.csv'
    )
  }

  const optionsCible = [
    {
      value: 'IGNORER',
      label: t(LIBELLES_CHAMP.IGNORER),
    },
    { value: 'PLAGE', label: t`Disponibilité seulement` },
    ...sequences.map(s => {
      const titreSequence = s.titre
      const jourSequence = libelleJours(s.jour)
      const heureDebut = s.heureDebut
      const heureFin = s.heureFin
      return {
        value: s.id,
        label: t`${titreSequence} · ${jourSequence}, ${heureDebut} → ${heureFin}`,
      }
    }),
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
  const accepterLesChoix =
    mode === 'PLACES_DIRECTES' || (mode === 'A_REPARTIR' && accepterTout)
  const titres = new Map(
    (programme?.programme ?? []).map(s => [s.id, s.titre] as const)
  )
  const remplacantDe = new Map(
    [...remplacements.entries()]
      .filter(([cle]) => remplace(cle))
      .map(([cle, annule]) => [annule.cle, cle] as const)
  )
  // Les billets annulés et les places qu'ils tiennent encore, hors celles que
  // leur billet de remplacement accepte.
  const annulees = lues.personnes.flatMap(p => {
    const ligne = simulation?.lignes.get(p.cle)
    if (!p.annulee || ligne?.etat !== 'ANNULEE') return []
    const remplacant = remplacantDe.get(p.cle)
    const gardees = new Set(
      remplacant && accepterLesChoix
        ? (lues.personnes.find(q => q.cle === remplacant)?.sequenceIds ?? [])
        : []
    )
    return [
      {
        personne: p,
        places: ligne.sequencesARetirer
          .filter(id => !gardees.has(id))
          .map(id => titres.get(id) ?? id),
      },
    ]
  })
  const annuleesNonTraitees = lues.personnes.filter(
    p => p.annulee && simulation?.lignes.get(p.cle)?.etat === 'DEJA_IMPORTEE'
  )
  const refsDuFichier = new Set(
    tableau
      ? tableau.lignes
          .map(l => (l[champs.indexOf('REF_EXTERNE')] ?? '').trim())
          .filter(Boolean)
      : []
  )
  const absents = (refsDeLaSource ?? []).filter(r => !refsDuFichier.has(r))
  const enConflit = lues.personnes.filter(
    p => (simulation?.lignes.get(p.cle)?.conflits.length ?? 0) > 0
  )
  const placesDirectesSansSequence =
    mode === 'PLACES_DIRECTES' &&
    !lues.personnes.some(p => p.sequenceIds.length > 0)

  // Les valeurs des messages sont des identifiants simples.
  const periodeCette = periode.cette
  const nbLignesLues = tableau?.lignes.length ?? 0
  const nbColonnesLues = tableau?.entetes.length ?? 0
  const numeroEtape = etape + 1
  const nombreEtapes = ETAPES.length
  const nomEtape = t(ETAPES[etape]!)
  const nbPersonnes = lues.personnes.length
  const nbEcarteesNavigateur = lues.ecartees.length
  const bilanSimule = simulation?.bilan
  const nbAImporter = bilanSimule?.aImporter ?? 0
  const nbDejaImportees = bilanSimule?.dejaImportees ?? 0
  const nbMisesAJour = bilanSimule?.misesAJour ?? 0
  const nbConflits = bilanSimule?.conflits ?? 0
  const nbAnnulees = bilanSimule?.annulees ?? 0
  const nbAnnuleesNonTraitees = annuleesNonTraitees.length
  const nbAbsents = absents.length
  const nbEcarteesTotal = (bilanSimule?.ecartees ?? 0) + nbEcarteesNavigateur
  const nbFichesCreees = bilanSimule?.fichesCreees ?? 0
  const nbFichesRattachees = bilanSimule?.fichesRattachees ?? 0
  const nbPlaces = bilanSimule?.places ?? 0
  const fichesRestantes = simulation?.fichesRestantes ?? 0
  const nbComptes = comptes.length
  const nbAutresEcartees = ecarteesToutes.length - 50
  const nbNonTraitees = echec?.restantes ?? 0
  const nbImportees = resultat?.aImporter ?? 0
  const nbFichesCreeesFinal = resultat?.fichesCreees ?? 0
  const nbFichesRattacheesFinal = resultat?.fichesRattachees ?? 0
  const nbPlacesFinal = resultat?.places ?? 0
  const nbDejaImporteesFinal = resultat?.dejaImportees ?? 0
  const nbMisesAJourFinal = resultat?.misesAJour ?? 0
  const nbAnnuleesFinal = resultat?.annulees ?? 0
  const nbPlacesRetireesFinal = resultat?.placesRetirees ?? 0
  const libelleLigne = (numero: number) => t`Ligne ${numero}`
  const libelleChampColonne = (entete: string) =>
    t`Champ de la colonne ${entete}`
  const libelleSequenceDe = (libelle: string) => t`Séquence de ${libelle}`

  return (
    <>
      <Titre
        sousTitre={t`Faites entrer une liste tenue hors de Relaytour : un export de billetterie, un formulaire, un tableur. Le fichier reste sur votre appareil.`}
        avant={
          <Link to={lien('/benevoles')} className="rt-note">
            <Trans>← Bénévoles</Trans>
          </Link>
        }
      >
        <Trans>Importer une liste de bénévoles</Trans>
      </Titre>
      {ecrans.md ? (
        <Steps
          current={etape}
          size="small"
          items={ETAPES.map(etapeNom => ({ title: t(etapeNom) }))}
          style={{ marginBottom: 24 }}
        />
      ) : (
        <p className="rt-note">
          <Trans>
            Étape {numeroEtape} sur {nombreEtapes} : {nomEtape}
          </Trans>
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
                oublierChoix()
              }}
            />
            <label className="rt-import-champ">
              <span className="rt-libelle">{t`Portée`}</span>
              <Select
                aria-label={t`Portée de l’import`}
                style={{ minWidth: 220 }}
                value={perimetreId ?? '__programme'}
                onChange={v => {
                  setPortee(v === '__programme' ? null : v)
                  oublierChoix()
                }}
                options={portees.map(p => ({
                  value: p.perimetreId ?? '__programme',
                  label: p.nom,
                }))}
              />
            </label>
            <label className="rt-import-champ">
              <span className="rt-libelle">{t`Source`}</span>
              <Input
                aria-label={t`Source de la liste`}
                placeholder={t`Billetterie du 7 août`}
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
              title={t`Vous n’écrivez dans aucun périmètre de ${periodeCette}.`}
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
              <Trans>
                Déposez un fichier CSV ou Excel (.xlsx), ou cliquez pour le
                choisir.
              </Trans>
            </p>
            <p className="rt-note">
              <Trans>2 Mo, 5 000 lignes et 200 colonnes au plus.</Trans>
            </p>
          </Upload.Dragger>
          {feuilles.length > 1 && (
            <label className="rt-import-champ">
              <span className="rt-libelle">{t`Feuille`}</span>
              <Select
                aria-label={t`Feuille du classeur`}
                value={feuille?.nom}
                onChange={setNomFeuille}
                options={feuilles.map(f => ({ value: f.nom, label: f.nom }))}
              />
            </label>
          )}
          {tableau && (
            <p className="rt-note">
              <Trans>
                {nbLignesLues} lignes et {nbColonnesLues} colonnes lues.
              </Trans>
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
              <Trans>Associer les colonnes</Trans>
            </Button>
          </Space>
        </section>
      )}

      {etape === 1 && tableau && (
        <section className="rt-verre rt-import-etape">
          <p>
            <Trans>
              Relaytour propose un champ pour chaque colonne, d’après son
              en-tête et son contenu. Corrigez au besoin. Une colonne ignorée ne
              quitte pas votre appareil.
            </Trans>
          </p>
          <ul className="rt-import-colonnes">
            {colonnes.map(c => (
              <li key={c.index} className="rt-import-colonne">
                <div>
                  <strong>{c.entete}</strong>
                  <span className="rt-note">
                    {c.exemples.length > 0
                      ? c.exemples.join(' · ')
                      : t`Colonne vide`}
                  </span>
                </div>
                <Select
                  aria-label={libelleChampColonne(c.entete)}
                  style={{ minWidth: 260 }}
                  value={c.champ}
                  disabled={c.sensible}
                  onChange={champ => {
                    // Un champ unique passe d'une colonne à l'autre : l'ancienne
                    // colonne revient à « Ignorer », et l'écran le dit.
                    const avant = champUnique(champ)
                      ? colonnes.find(x => x !== c && x.champ === champ)
                      : undefined
                    setColonnes(
                      colonnes.map(x =>
                        x === c
                          ? { ...x, champ, confiance: 'HAUTE' }
                          : x === avant
                            ? { ...x, champ: 'IGNORER', confiance: 'HAUTE' }
                            : x
                      )
                    )
                    if (avant) {
                      const enteteColonne = avant.entete
                      const libelleChampUnique = t(LIBELLES_CHAMP[champ])
                      message.info(
                        t`La colonne « ${enteteColonne} » passe à « Ignorer » : « ${libelleChampUnique} » ne vient que d’une colonne.`
                      )
                    }
                  }}
                  options={(Object.keys(LIBELLES_CHAMP) as Champ[]).map(
                    champ => ({
                      value: champ,
                      label: t(LIBELLES_CHAMP[champ]),
                    })
                  )}
                />
                {c.sensible ? (
                  <Tag>{t`Donnée sensible : ignorée`}</Tag>
                ) : c.champ !== 'IGNORER' && c.confiance !== 'HAUTE' ? (
                  <Tag color="warning">{t`À vérifier`}</Tag>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="rt-import-reglages">
            <Input
              aria-label={t`Nom de la correspondance`}
              placeholder={t`Nom de la correspondance, par exemple « Billetterie »`}
              style={{ maxWidth: 320 }}
              value={nomCorrespondance}
              onChange={e => setNomCorrespondance(e.target.value)}
            />
            <Button
              disabled={nomCorrespondance.trim() === ''}
              loading={enregistrement.loading}
              onClick={() => void enregistrerCorrespondance()}
            >
              <Trans>Enregistrer la correspondance</Trans>
            </Button>
            {(correspondances?.correspondancesImport.length ?? 0) > 0 && (
              <Select
                aria-label={t`Appliquer une correspondance`}
                placeholder={t`Appliquer une correspondance`}
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
              title={t`Associez au moins un nom, une adresse ou un téléphone.`}
            />
          )}
          <Space>
            <Button onClick={() => setEtape(0)}>
              <Trans>Précédent</Trans>
            </Button>
            <Button
              type="primary"
              disabled={!associationSuffisante(champs)}
              onClick={() => setEtape(2)}
            >
              <Trans>Associer les séquences</Trans>
            </Button>
          </Space>
        </section>
      )}

      {etape === 2 && tableau && (
        <section className="rt-verre rt-import-etape">
          <div className="rt-import-reglages">
            <label className="rt-import-champ">
              <span className="rt-libelle">{t`Jour des horaires sans jour`}</span>
              <Select
                aria-label={t`Jour des horaires sans jour`}
                style={{ minWidth: 200 }}
                value={jourRetenu}
                onChange={setJour}
                options={jours.map(j => ({ value: j, label: libelleJours(j) }))}
              />
            </label>
            <label className="rt-import-champ">
              <span className="rt-libelle">
                {t`Valeurs qui signifient « non »`}
              </span>
              <Select
                aria-label={t`Valeurs qui signifient non`}
                mode="tags"
                style={{ minWidth: 260 }}
                value={valeursNon}
                onChange={setValeursNon}
              />
            </label>
            {champs.includes('ANNULATION') && (
              <label className="rt-import-champ">
                <span className="rt-libelle">
                  {t`Valeurs qui signifient « annulé »`}
                </span>
                <Select
                  aria-label={t`Valeurs qui signifient annulé`}
                  mode="tags"
                  style={{ minWidth: 260 }}
                  value={valeursAnnulees}
                  onChange={setValeursAnnulees}
                />
              </label>
            )}
          </div>
          {choix.length === 0 ? (
            <p className="rt-note">
              <Trans>
                Aucune colonne ne porte de poste ni de créneau. Les personnes
                rejoindront les bénévoles à répartir, avec leurs précisions.
              </Trans>
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
                    aria-label={libelleSequenceDe(c.libelle)}
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
              <Trans>
                À répartir : chaque personne devient une candidature à traiter.
              </Trans>
            </Radio>
            <Radio value="PLACES_DIRECTES">
              <Trans>
                Places directes : chaque personne reçoit sa fiche et ses places.
              </Trans>
            </Radio>
          </Radio.Group>
          {mode === 'A_REPARTIR' && (
            <Checkbox
              checked={accepterTout}
              onChange={e => setAccepterTout(e.target.checked)}
            >
              <Trans>
                Accepter tout : les séquences associées sont acceptées dès
                l’import.
              </Trans>
            </Checkbox>
          )}
          <Checkbox
            checked={prevenirParMail}
            onChange={e => setPrevenirParMail(e.target.checked)}
          >
            <Trans>
              Prévenir par mail : la première place d’une personne lui envoie
              son lien personnel.
            </Trans>
          </Checkbox>
          {gere && (
            <Checkbox
              checked={mettreAJour}
              onChange={e => setMettreAJour(e.target.checked)}
            >
              <Trans>
                Mettre à jour les personnes déjà importées : Relaytour les
                retrouve par leur identifiant externe, complète leurs champs
                vides et ajoute leurs nouvelles séquences, sans aucun mail.
              </Trans>
            </Checkbox>
          )}
          {gere && mettreAJour && champs.includes('ANNULATION') && (
            <Checkbox
              checked={retirerPlacesAnnulees}
              onChange={e => setRetirerPlacesAnnulees(e.target.checked)}
            >
              <Trans>
                Retirer les places des billets annulés. Une place acceptée pour
                un autre billet de la même personne reste en place. Aucun mail
                ne part.
              </Trans>
            </Checkbox>
          )}
          <Space>
            <Button onClick={() => setEtape(1)}>
              <Trans>Précédent</Trans>
            </Button>
            <Button
              type="primary"
              onClick={() => {
                setSimulation(null)
                setDecisions(new Map())
                setEtape(3)
              }}
            >
              <Trans>Voir l’aperçu</Trans>
            </Button>
          </Space>
        </section>
      )}

      {etape === 3 && tableau && (
        <section className="rt-verre rt-import-etape">
          <p>
            {t`${plural(nbPersonnes, { one: '# personne', other: '# personnes' })}, ${plural(nbEcarteesNavigateur, { one: '# ligne écartée', other: '# lignes écartées' })}.`}
          </p>
          {placesDirectesSansSequence && (
            <Alert
              type="warning"
              showIcon
              title={t`Le mode « places directes » exige au moins une colonne associée à une séquence.`}
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
              <Trans>Vérifier la liste</Trans>
            </Button>
          ) : (
            <>
              <ul className="rt-import-bilan">
                <li>
                  <Trans>{nbAImporter} à importer</Trans>
                </li>
                <li>
                  <Trans>{nbDejaImportees} déjà importées</Trans>
                </li>
                {mettreAJour && gere && (
                  <li>
                    <Trans>{nbMisesAJour} mises à jour</Trans>
                  </li>
                )}
                {nbConflits > 0 && (
                  <li>
                    <Trans>{nbConflits} conflits</Trans>
                  </li>
                )}
                {nbAnnulees > 0 && (
                  <li>
                    <Trans>{nbAnnulees} billets annulés</Trans>
                  </li>
                )}
                <li>
                  <Trans>{nbEcarteesTotal} écartées</Trans>
                </li>
                <li>
                  <Trans>{nbFichesCreees} fiches créées</Trans>
                </li>
                <li>
                  <Trans>{nbFichesRattachees} fiches rejointes</Trans>
                </li>
                <li>
                  <Trans>{nbPlaces} places</Trans>
                </li>
              </ul>
              {simulation.bilan.fichesCreees > simulation.fichesRestantes && (
                <Alert
                  type="error"
                  showIcon
                  title={t`L’activité peut encore recevoir ${fichesRestantes} fiches : réduisez la liste.`}
                />
              )}
              {simulation.depassements.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  title={t`Des séquences dépassent leurs renforts recherchés.`}
                  description={simulation.depassements
                    .map(d => {
                      const titreSequence = d.titre
                      const renforts = d.renforts
                      const besoin = d.besoin
                      return t`${titreSequence} : ${renforts} pour ${besoin}`
                    })
                    .join(' · ')}
                />
              )}
              {rapprochees.length > 0 && (
                <>
                  <h2 className="rt-intertitre">
                    <Trans>Fiches proches</Trans>
                  </h2>
                  <ul className="rt-import-colonnes">
                    {rapprochees.map(p => {
                      const r = simulation.lignes.get(p.cle)!.rapprochement!
                      const niveau = LIBELLES_NIVEAU[r.niveau]
                      const lignesPersonne = p.lignes.join(', ')
                      const nomFiche = r.nom
                      const decision =
                        decisions.get(p.cle) ??
                        (r.niveau === 'FORT' ? 'RATTACHER' : 'CREER')
                      return (
                        <li key={p.cle} className="rt-import-colonne">
                          <div>
                            <strong>{p.nom}</strong>
                            <span className="rt-note">
                              {t`Ligne ${lignesPersonne} · fiche « ${nomFiche} »`}
                            </span>
                          </div>
                          <Tag color={niveau.couleur}>{t(niveau.libelle)}</Tag>
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
                              <Trans>Rejoindre « {nomFiche} »</Trans>
                            </Radio>
                            <Radio value="CREER">
                              <Trans>Créer une fiche</Trans>
                            </Radio>
                          </Radio.Group>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
              {remplacements.size > 0 && (
                <>
                  <h2 className="rt-intertitre">
                    <Trans>Billets de remplacement</Trans>
                  </h2>
                  <p className="rt-note">
                    <Trans>
                      Ces nouveaux billets semblent remplacer un billet annulé
                      du fichier. Un billet de remplacement rejoint la fiche du
                      billet annulé, avec son lien et ses disponibilités, sans
                      aucun mail.
                    </Trans>
                  </p>
                  <ul className="rt-import-colonnes">
                    {[...remplacements.entries()].map(([cle, annule]) => {
                      const nouveau = lues.personnes.find(q => q.cle === cle)!
                      const refNouveau = nouveau.refExterne ?? ''
                      const refAnnule = annule.refExterne ?? ''
                      const nomAnnule = annule.nom
                      return (
                        <li key={cle} className="rt-import-colonne">
                          <div>
                            <strong>{nouveau.nom}</strong>
                            <span className="rt-note">
                              {t`Billet ${refNouveau} · billet annulé ${refAnnule} (${nomAnnule})`}
                            </span>
                          </div>
                          <Radio.Group
                            value={remplace(cle)}
                            onChange={e =>
                              setDecisionsRemplacement(
                                new Map(decisionsRemplacement).set(
                                  cle,
                                  e.target.value as boolean
                                )
                              )
                            }
                          >
                            <Radio value={true}>
                              <Trans>Remplace le billet {refAnnule}</Trans>
                            </Radio>
                            <Radio value={false}>
                              <Trans>Nouvelle personne</Trans>
                            </Radio>
                          </Radio.Group>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
              {annulees.length > 0 && (
                <>
                  <h2 className="rt-intertitre">
                    <Trans>Billets annulés</Trans>
                  </h2>
                  <p className="rt-note">
                    {retirerPlacesAnnulees ? (
                      <Trans>
                        La candidature de chaque billet annulé se retire, et ses
                        places listées ici sont retirées. La fiche reste.
                      </Trans>
                    ) : (
                      <Trans>
                        La candidature de chaque billet annulé se retire. Ses
                        places listées ici restent : retirez-les dans le
                        programme, ou cochez « Retirer les places des billets
                        annulés ». La fiche reste.
                      </Trans>
                    )}
                  </p>
                  <ul className="rt-import-ecartees">
                    {annulees.map(({ personne, places }) => {
                      const refAnnule = personne.refExterne ?? ''
                      const listePlaces = places.join(', ')
                      return (
                        <li key={personne.cle}>
                          <strong>{personne.nom}</strong>{' '}
                          {places.length > 0
                            ? t`Billet ${refAnnule} · ${listePlaces}`
                            : t`Billet ${refAnnule} · aucune place`}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
              {annuleesNonTraitees.length > 0 && (
                <Alert
                  type="info"
                  showIcon
                  title={
                    gere
                      ? t`${plural(nbAnnuleesNonTraitees, { one: '# billet annulé est déjà importé. Cochez « Mettre à jour les personnes déjà importées » pour retirer sa candidature.', other: '# billets annulés sont déjà importés. Cochez « Mettre à jour les personnes déjà importées » pour retirer leurs candidatures.' })}`
                      : t`${plural(nbAnnuleesNonTraitees, { one: '# billet annulé est déjà importé. Un admin de l’activité peut retirer sa candidature.', other: '# billets annulés sont déjà importés. Un admin de l’activité peut retirer leurs candidatures.' })}`
                  }
                />
              )}
              {absents.length > 0 && (
                <Alert
                  type="info"
                  showIcon
                  title={t`${plural(nbAbsents, { one: '# billet déjà importé n’apparaît pas dans ce fichier.', other: '# billets déjà importés n’apparaissent pas dans ce fichier.' })}`}
                  description={
                    <>
                      <Trans>
                        L’import ne les modifie pas : un export filtré n’annule
                        aucun billet.
                      </Trans>{' '}
                      {absents.slice(0, 20).join(', ')}
                      {absents.length > 20 && ' …'}
                    </>
                  }
                />
              )}
              {enConflit.length > 0 && (
                <>
                  <h2 className="rt-intertitre">
                    <Trans>Valeurs gardées</Trans>
                  </h2>
                  <p className="rt-note">
                    <Trans>
                      Ces personnes ont déjà une autre valeur dans Relaytour.
                      L’import garde cette valeur. Modifiez la fiche à la main
                      si la valeur du fichier est la bonne.
                    </Trans>
                  </p>
                  <ul className="rt-import-ecartees">
                    {enConflit.map(p => {
                      const lignesPersonne = p.lignes.join(', ')
                      const champsEnConflit = simulation.lignes
                        .get(p.cle)!
                        .conflits.map(c => t(LIBELLES_CHAMP_IMPORT[c]))
                        .join(', ')
                      return (
                        <li key={p.cle}>
                          <strong>{p.nom}</strong>{' '}
                          {t`Ligne ${lignesPersonne} · ${champsEnConflit}`}
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
                  title={t`${plural(nbComptes, { one: '# adresse est celle d’un compte de l’organisation.', other: '# adresses sont celles d’un compte de l’organisation.' })}`}
                  description={comptes.map(p => p.nom).join(', ')}
                />
              )}
              {ecarteesToutes.length > 0 && (
                <>
                  <h2 className="rt-intertitre">
                    <Trans>Lignes écartées</Trans>
                  </h2>
                  <ul className="rt-import-ecartees">
                    {ecarteesToutes.slice(0, 50).map(e => (
                      <li key={`${e.ligne}-${e.motif}`}>
                        <strong>{libelleLigne(e.ligne)}</strong> · {e.motif}
                      </li>
                    ))}
                  </ul>
                  {ecarteesToutes.length > 50 && (
                    <p className="rt-note">
                      <Trans>
                        Et {nbAutresEcartees} autres lignes, dans le fichier à
                        télécharger.
                      </Trans>
                    </p>
                  )}
                  <Button onClick={() => void telechargerEcartees()}>
                    <Trans>Télécharger les lignes écartées</Trans>
                  </Button>
                </>
              )}
              <Checkbox
                checked={accord}
                onChange={e => setAccord(e.target.checked)}
              >
                <Trans>
                  Les personnes de cette liste ont accepté que leurs coordonnées
                  soient enregistrées pour organiser l’activité.
                </Trans>
              </Checkbox>
            </>
          )}
          <Space>
            <Button onClick={() => setEtape(2)}>
              <Trans>Précédent</Trans>
            </Button>
            <Button
              type="primary"
              disabled={
                !simulation ||
                !accord ||
                simulation.bilan.aImporter +
                  simulation.bilan.misesAJour +
                  simulation.bilan.annulees ===
                  0 ||
                simulation.bilan.fichesCreees > simulation.fichesRestantes
              }
              onClick={() => void lancer()}
            >
              <Trans>Importer</Trans>
            </Button>
          </Space>
        </section>
      )}

      {etape === 4 && (
        <section className="rt-verre rt-import-etape">
          {resultat === null ? (
            <>
              <p>
                <Trans>Import en cours…</Trans>
              </p>
              <Progress percent={progression} />
            </>
          ) : (
            <Result
              status={echec ? 'warning' : 'success'}
              title={
                echec
                  ? t`L’import s’est arrêté : ${plural(nbNonTraitees, { one: '# personne n’a pas été traitée', other: '# personnes n’ont pas été traitées' })}.`
                  : t`${plural(nbImportees, { one: '# personne importée', other: '# personnes importées' })}.`
              }
              subTitle={
                <>
                  {echec && (
                    <span className="rt-import-echec">
                      {echec.motif}{' '}
                      <Trans>
                        Relancez l’import du même fichier : les personnes déjà
                        importées seront reconnues.
                      </Trans>
                    </span>
                  )}
                  {t`${nbImportees} personnes importées, ${nbFichesCreeesFinal} fiches créées, ${nbFichesRattacheesFinal} fiches rejointes, ${nbPlacesFinal} places, ${nbDejaImporteesFinal} déjà importées.`}
                  {nbMisesAJourFinal > 0 &&
                    ` ${t`${nbMisesAJourFinal} personnes mises à jour.`}`}
                  {nbAnnuleesFinal > 0 &&
                    ` ${t`${nbAnnuleesFinal} billets annulés, ${nbPlacesRetireesFinal} places retirées.`}`}
                </>
              }
              extra={[
                <Button
                  key="candidatures"
                  type="primary"
                  onClick={() =>
                    void naviguer(lien('/benevoles?onglet=candidatures'))
                  }
                >
                  <Trans>Voir les candidatures</Trans>
                </Button>,
                <Button
                  key="repartition"
                  onClick={() =>
                    void naviguer(lien('/programme?vue=repartition'))
                  }
                >
                  <Trans>Répartir dans le programme</Trans>
                </Button>,
              ]}
            />
          )}
          <Typography.Paragraph className="rt-note">
            <Trans>
              Aucun mail ne part à l’import. La première place d’une personne
              joignable lui envoie son lien personnel.
            </Trans>{' '}
            {mettreAJour && gere && (
              <Trans>
                Une mise à jour n’envoie aucun mail. Après l’ajout d’une adresse
                par une mise à jour, l’option « Prévenir par mail » de la fiche
                reste décochée.
              </Trans>
            )}
          </Typography.Paragraph>
        </section>
      )}
    </>
  )
}
