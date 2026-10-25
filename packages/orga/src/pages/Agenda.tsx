import { useMutation, useQuery } from '@apollo/client/react'
import {
  DeleteOutlined,
  EditOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural, t } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Empty, Grid, Result, Skeleton } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { AbonnementActivite } from '../composants/AbonnementAgenda'
import ChoixEdition from '../composants/ChoixEdition'
import DateCleFormulaire, {
  type DateCleSaisie,
} from '../composants/DateCleFormulaire'
import { DeuxColonnes, Panneau, Section } from '../composants/Panneau'
import PastillePerimetre from '../composants/PastillePerimetre'
import ReunionDetail from '../composants/ReunionDetail'
import SondageDetail from '../composants/SondageDetail'
import SondageFormulaire, {
  type NouveauSondage,
} from '../composants/SondageFormulaire'
import ReunionFormulaire, {
  type AgendaEcrit,
  type NouvelleReunion,
} from '../composants/ReunionFormulaire'
import { PuceBascule, Puces, SeparateurPuces } from '../composants/Puces'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type {
  AgendaQuery,
  ReponseConvocation,
  ReunionsQuery,
  SorteElementAgenda,
} from '../gql/graphql'
import {
  couvre,
  decalerMois,
  grilleDuMois,
  grouperParMoisAgenda,
  joursDeLaSemaine,
  jourLocal,
  libelleJours,
  quantieme,
  toucheLeMois,
} from '../lib/agenda'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import { ecrireRegroupement, lireRegroupement } from '../lib/regroupement'
import { EDITION_COURANTE, PERIMETRES } from '../lib/requetes'
import { libelleMois } from '../lib/retroplanning'
import { langueActive } from '../lib/langue'

const AGENDA = graphql(`
  query Agenda($editionId: ID!, $echeances: Boolean) {
    agenda(editionId: $editionId, echeances: $echeances) {
      peutGerer
      edition {
        id
        nom
        statut
      }
      elements {
        cle
        sorte
        titre
        jour
        jourFin
        description
        dateCleId
        version
        tacheId
        perimetreId
        faite
      }
    }
  }
`)

const REUNIONS = graphql(`
  query Reunions($editionId: ID!) {
    reunions(editionId: $editionId) {
      id
      titre
      jour
      jourFin
      heureDebut
      heureFin
      statut
      lieu
      detailMasque
      estConvoquee
      maReponse
      perimetre {
        id
      }
    }
  }
`)

const SONDAGES = graphql(`
  query Sondages($editionId: ID!) {
    sondages(editionId: $editionId) {
      id
      titre
      statut
      estParticipant
      aRepondu
      participants
      repondants
      perimetre {
        id
      }
    }
  }
`)

// Les périmètres où la personne écrit pour la période : ses affectations.
const MES_AFFECTATIONS = graphql(`
  query AffectationsPourAgenda($editionId: ID!) {
    moi {
      id
      affectations(editionId: $editionId) {
        id
        perimetre {
          id
        }
      }
    }
  }
`)

const SUPPRIMER = graphql(`
  mutation SupprimerDateCle($id: ID!) {
    supprimerDateCle(id: $id)
  }
`)

type Element = AgendaQuery['agenda']['elements'][number]
type ReunionDeListe = ReunionsQuery['reunions'][number]
type Sorte = SorteElementAgenda | 'REUNION'
/** Une ligne de l'agenda : un élément du serveur, ou une réunion. */
type Ligne = Omit<Element, 'sorte'> & {
  sorte: Sorte
  reunion?: ReunionDeListe
}
type Vue = 'liste' | 'mois'
const VUES = ['liste', 'mois'] as const
/** Clé de l'affichage de l'agenda, gardé dans le navigateur. */
const CLE_VUE_AGENDA = 'relaytour.agenda.vue'

const LIBELLES_SORTES: Record<Sorte, MessageDescriptor> = {
  PHASE: msg({ message: 'Phase', comment: 'Sorte d’élément de l’agenda' }),
  DEBUT_PERIODE: msg({
    message: 'Période',
    comment: 'Sorte d’élément de l’agenda : le début de la période',
  }),
  FIN_PERIODE: msg({
    message: 'Période',
    comment: 'Sorte d’élément de l’agenda : la fin de la période',
  }),
  DATE_CLE: msg({
    message: 'Date clé',
    comment: 'Sorte d’élément de l’agenda',
  }),
  REUNION: msg({ message: 'Réunion', comment: 'Sorte d’élément de l’agenda' }),
  ECHEANCE: msg({
    message: 'Échéance',
    comment: 'Sorte d’élément de l’agenda : l’échéance d’une tâche',
  }),
}

// Dans un même jour : les repères de la période, puis les réunions par heure,
// puis les échéances.
const ORDRE: Record<Sorte, number> = {
  PHASE: 0,
  DEBUT_PERIODE: 1,
  FIN_PERIODE: 2,
  DATE_CLE: 3,
  REUNION: 4,
  ECHEANCE: 5,
}

const REPONSES: Record<ReponseConvocation, MessageDescriptor> = {
  PRESENT: msg({
    message: 'présent·e',
    comment:
      'Réponse à une convocation, en minuscules, après « Vous êtes convoqué·e, »',
  }),
  ABSENT: msg({
    message: 'absent·e',
    comment:
      'Réponse à une convocation, en minuscules, après « Vous êtes convoqué·e, »',
  }),
  PEUT_ETRE: msg({
    message: 'peut-être',
    comment:
      'Réponse à une convocation, en minuscules, après « Vous êtes convoqué·e, »',
  }),
}

/** Une réunion, en ligne de l'agenda. */
function ligneDeReunion(r: ReunionDeListe): Ligne {
  return {
    cle: `reunion-${r.id}`,
    sorte: 'REUNION',
    titre: r.titre,
    jour: r.jour,
    jourFin: r.jourFin === r.jour ? null : r.jourFin,
    description: null,
    dateCleId: null,
    version: null,
    tacheId: null,
    perimetreId: r.perimetre?.id ?? null,
    faite: false,
    reunion: r,
  }
}

const majuscule = (texte: string) =>
  texte.charAt(0).toUpperCase() + texte.slice(1)

const compteElements = (n: number) =>
  t`${plural(n, { one: '# élément', other: '# éléments' })}`

export default function Agenda() {
  const { t } = useLingui()
  const { lien, periode, activite, gere } = useActivite()
  const periodeAucune = periode.Aucune
  const periodeDe = periode.de
  const periodeCette = periode.cette
  const { message, modal } = App.useApp()
  const ecrans = Grid.useBreakpoint()
  const [parametres, setParametres] = useSearchParams()
  const { data: courante } = useQuery(EDITION_COURANTE)
  const { data: perimetres } = useQuery(PERIMETRES)
  const editionId = parametres.get('edition') ?? courante?.editionCourante?.id
  const [echeances, setEcheances] = useState(true)
  const [passe, setPasse] = useState(false)
  const [vueChoisie, setVueChoisie] = useState<Vue>(() =>
    lireRegroupement(CLE_VUE_AGENDA, VUES, 'liste')
  )
  const setVue = (valeur: Vue) => {
    setVueChoisie(valeur)
    ecrireRegroupement(CLE_VUE_AGENDA, valeur)
  }
  const aujourdhui = jourLocal()
  const [mois, setMois] = useState(aujourdhui.slice(0, 7))
  const [saisie, setSaisie] = useState<DateCleSaisie | 'nouvelle' | null>(null)
  const [nouvelleReunion, setNouvelleReunion] =
    useState<NouvelleReunion | null>(null)
  const reunionOuverte = parametres.get('reunion')
  const sondageOuvert = parametres.get('sondage')
  const ouvrir = (cle: 'reunion' | 'sondage', id: string | null) => {
    const suite = new URLSearchParams(parametres)
    if (id === null) suite.delete(cle)
    else suite.set(cle, id)
    setParametres(suite)
  }
  const ouvrirReunion = (id: string | null) => ouvrir('reunion', id)
  const [nouveauSondage, setNouveauSondage] = useState<NouveauSondage | null>(
    null
  )
  const { data, error } = useQuery(AGENDA, {
    variables: { editionId: editionId ?? '', echeances },
    skip: editionId === undefined,
    fetchPolicy: 'cache-and-network',
  })
  const { data: reunions } = useQuery(REUNIONS, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
    fetchPolicy: 'cache-and-network',
  })
  const { data: sondages } = useQuery(SONDAGES, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
    fetchPolicy: 'cache-and-network',
  })
  const { data: moi } = useQuery(MES_AFFECTATIONS, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
  })
  const [supprimer] = useMutation(SUPPRIMER, { refetchQueries: ['Agenda'] })

  // La grille du mois demande de la largeur : un téléphone garde la liste.
  const vue: Vue = vueChoisie === 'mois' && ecrans.md ? 'mois' : 'liste'
  const agenda = data?.agenda
  const elements = useMemo(() => agenda?.elements ?? [], [agenda])
  const phases = elements.filter(e => e.sorte === 'PHASE')
  const datesCles = elements.filter(e => e.sorte === 'DATE_CLE')
  const perimetreDe = useMemo(
    () => new Map((perimetres?.perimetres ?? []).map(p => [p.id, p])),
    [perimetres]
  )
  // Les éléments du serveur et les réunions, rangés par jour.
  const lignes = useMemo(() => {
    const toutes: Ligne[] = [
      ...elements,
      ...(reunions?.reunions ?? []).map(ligneDeReunion),
    ]
    return toutes.sort(
      (a, b) =>
        a.jour.localeCompare(b.jour) ||
        ORDRE[a.sorte] - ORDRE[b.sorte] ||
        (a.reunion?.heureDebut ?? '').localeCompare(
          b.reunion?.heureDebut ?? ''
        ) ||
        a.titre.localeCompare(b.titre, langueActive())
    )
  }, [elements, reunions])
  const groupes = useMemo(
    () => grouperParMoisAgenda(lignes, passe ? null : aujourdhui),
    [lignes, passe, aujourdhui]
  )
  // Les agendas où la personne écrit : l'agenda global et tous les périmètres pour
  // un admin de l'activité, ses périmètres de la période sinon.
  const agendasEcrits = useMemo((): AgendaEcrit[] => {
    if (!agenda || agenda.edition.statut === 'ARCHIVEE') return []
    const tous = (perimetres?.perimetres ?? []).filter(p => !p.archive)
    if (agenda.peutGerer) {
      return [
        { perimetreId: null, nom: t`Agenda global de l’activité` },
        ...tous.map(p => ({ perimetreId: p.id, nom: p.nom })),
      ]
    }
    const miens = new Set(
      (moi?.moi?.affectations ?? []).map(a => a.perimetre.id)
    )
    return tous
      .filter(p => miens.has(p.id))
      .map(p => ({ perimetreId: p.id, nom: p.nom }))
  }, [agenda, perimetres, moi, t])

  if (editionId === undefined && courante && !courante.editionCourante) {
    // L'abonnement partagé ne dépend d'aucune période : ses admins le gèrent
    // même sans période en préparation.
    return (
      <>
        <Result
          status="info"
          title={t`${periodeAucune} n’est en préparation.`}
        />
        {gere && (
          <AbonnementActivite activiteId={activite.id} nom={activite.nom} />
        )}
      </>
    )
  }
  if (error && !data) {
    return (
      <Result
        status="warning"
        title={t`L’agenda n’a pas pu être chargé.`}
        subTitle={t`Rechargez la page dans un instant.`}
      />
    )
  }

  const confirmerSuppression = (element: Ligne) => {
    if (!element.dateCleId) return
    const id = element.dateCleId
    const titreDateCle = element.titre
    void modal.confirm({
      title: t`Supprimer cette date clé ?`,
      content: t`« ${titreDateCle} » disparaît de l’agenda de chaque personne.`,
      okText: t`Supprimer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await supprimer({ variables: { id } })
          message.success(t`Date clé supprimée.`)
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })
  }

  const modifier = (element: Ligne) =>
    element.dateCleId &&
    setSaisie({
      id: element.dateCleId,
      titre: element.titre,
      jour: element.jour,
      jourFin: element.jourFin,
      description: element.description,
      version: element.version ?? 0,
    })

  const gestesDateCle = (element: Ligne) => {
    if (!agenda?.peutGerer || element.sorte !== 'DATE_CLE') return false
    const titreDateCle = element.titre
    return (
      <span className="rt-agenda-gestes">
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          aria-label={t`Modifier « ${titreDateCle} »`}
          onClick={() => modifier(element)}
        />
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          aria-label={t`Supprimer « ${titreDateCle} »`}
          onClick={() => confirmerSuppression(element)}
        />
      </span>
    )
  }

  const titreElement = (element: Ligne) => {
    const reunion = element.reunion
    if (reunion) {
      return (
        <button
          type="button"
          className={`rt-agenda-ouvrir${reunion.statut === 'ANNULEE' ? ' rt-agenda-annulee' : ''}`}
          onClick={() => ouvrirReunion(reunion.id)}
        >
          {element.titre}
        </button>
      )
    }
    const perimetre = element.perimetreId
      ? perimetreDe.get(element.perimetreId)
      : undefined
    if (element.sorte === 'ECHEANCE' && perimetre) {
      return (
        <Link
          // La tâche visée s'affiche quel que soit le filtre du périmètre.
          to={lien(
            `/perimetres/${perimetre.slug}?edition=${editionId}${element.tacheId ? `&tache=${element.tacheId}` : ''}`
          )}
          className={element.faite ? 'rt-agenda-faite' : undefined}
        >
          {element.titre}
        </Link>
      )
    }
    return <span>{element.titre}</span>
  }

  const ligne = (element: Ligne) => {
    const perimetre = element.perimetreId
      ? perimetreDe.get(element.perimetreId)
      : undefined
    const reunion = element.reunion
    const reponseConvocation = reunion?.maReponse
      ? t(REPONSES[reunion.maReponse])
      : null
    return (
      <li
        key={element.cle}
        className={`rt-agenda-ligne rt-agenda-${element.sorte.toLowerCase()}`}
      >
        <span className="rt-agenda-jour">
          {libelleJours(element.jour, element.jourFin)}
          {reunion && ` · ${reunion.heureDebut}`}
        </span>
        <span className="rt-agenda-corps">
          <span className="rt-agenda-sorte">
            {t(LIBELLES_SORTES[element.sorte])}
          </span>
          <span className="rt-agenda-titre">{titreElement(element)}</span>
          {perimetre && (
            <PastillePerimetre
              nom={perimetre.nom}
              couleur={perimetre.couleur}
            />
          )}
          {element.description && (
            <span className="rt-note rt-agenda-description">
              {element.description}
            </span>
          )}
          {reunion && (
            <span className="rt-note rt-agenda-description">
              {[
                reunion.statut === 'ANNULEE' ? t`Annulée` : null,
                reunion.lieu,
                reunion.estConvoquee
                  ? reponseConvocation
                    ? t`Vous êtes convoqué·e, ${reponseConvocation}`
                    : t`Vous êtes convoqué·e, sans réponse`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
        {gestesDateCle(element)}
      </li>
    )
  }

  const listeParMois =
    groupes.length === 0 ? (
      <div className="rt-verre rt-panneau">
        <Empty
          description={
            passe
              ? t`L’agenda ${periodeDe} est vide.`
              : t`Aucune date à venir dans l’agenda.`
          }
        />
      </div>
    ) : (
      groupes.map(groupe => (
        <Section
          key={groupe.mois}
          titre={majuscule(libelleMois(groupe.mois))}
          compte={compteElements(groupe.elements.length)}
        >
          <ul className="rt-agenda-liste">{groupe.elements.map(ligne)}</ul>
        </Section>
      ))
    )

  const elementsDuMois = lignes.filter(
    e => e.sorte !== 'PHASE' && toucheLeMois(e, mois)
  )
  const phasesDuMois = phases.filter(p => toucheLeMois(p, mois))
  const nombrePhases = phasesDuMois.length
  const listePhases = phasesDuMois
    .map(p => `${p.titre} (${libelleJours(p.jour, p.jourFin)})`)
    .join(', ')
  const grille = (
    <Section
      titre={majuscule(libelleMois(mois))}
      compte={compteElements(elementsDuMois.length)}
      extra={
        <span className="rt-agenda-navigation">
          <Button
            size="small"
            icon={<LeftOutlined />}
            aria-label={t`Mois précédent`}
            onClick={() => setMois(m => decalerMois(m, -1))}
          />
          <Button size="small" onClick={() => setMois(aujourdhui.slice(0, 7))}>
            <Trans>Aujourd’hui</Trans>
          </Button>
          <Button
            size="small"
            icon={<RightOutlined />}
            aria-label={t`Mois suivant`}
            onClick={() => setMois(m => decalerMois(m, 1))}
          />
        </span>
      }
    >
      {phasesDuMois.length > 0 && (
        <p className="rt-note" style={{ margin: '0 6px' }}>
          {t`${plural(nombrePhases, {
            one: `Phase : ${listePhases}`,
            other: `Phases : ${listePhases}`,
          })}`}
        </p>
      )}
      <div
        className="rt-agenda-grille"
        role="grid"
        aria-label={t`Jours du mois`}
      >
        <div role="row" className="rt-agenda-semaine">
          {joursDeLaSemaine().map(j => (
            <span key={j} role="columnheader" className="rt-agenda-entete">
              {j}
            </span>
          ))}
        </div>
        {grilleDuMois(mois).map(semaine => (
          <div key={semaine[0]?.jour} role="row" className="rt-agenda-semaine">
            {semaine.map(({ jour, dansLeMois }) => {
              const duJour = elementsDuMois.filter(e => couvre(e, jour))
              return (
                <div
                  key={jour}
                  role="gridcell"
                  className={[
                    'rt-agenda-case',
                    dansLeMois ? '' : 'rt-agenda-hors-mois',
                    jour === aujourdhui ? 'rt-agenda-aujourdhui' : '',
                  ].join(' ')}
                >
                  <span className="rt-agenda-quantieme">{quantieme(jour)}</span>
                  {duJour.map(e => {
                    const reunion = e.reunion
                    const heureReunion = reunion?.heureDebut
                    const titreEvenement = e.titre
                    const classe = `rt-agenda-evenement rt-agenda-${e.sorte.toLowerCase()}`
                    return reunion ? (
                      <button
                        key={e.cle}
                        type="button"
                        className={`${classe}${reunion.statut === 'ANNULEE' ? ' rt-agenda-annulee' : ''}`}
                        title={t`Réunion · ${heureReunion} · ${titreEvenement}`}
                        onClick={() => ouvrirReunion(reunion.id)}
                      >
                        {reunion.heureDebut} {e.titre}
                      </button>
                    ) : (
                      <span
                        key={e.cle}
                        className={classe}
                        title={`${t(LIBELLES_SORTES[e.sorte])} · ${e.titre}`}
                      >
                        {e.titre}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Section>
  )

  return (
    <>
      <Titre
        sousTitre={t`Les phases, les dates clés, les réunions et les échéances ${periodeDe}.`}
        actions={
          <>
            {agendasEcrits.length > 0 && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  setNouvelleReunion({
                    perimetreId: agendasEcrits[0]?.perimetreId ?? null,
                  })
                }
              >
                <Trans>Nouvelle réunion</Trans>
              </Button>
            )}
            <ChoixEdition
              valeur={editionId}
              onChange={id => setParametres({ edition: id })}
            />
          </>
        }
      >
        {t`Agenda`}
      </Titre>

      <div className="rt-puces" style={{ marginBottom: 22, rowGap: 10 }}>
        {ecrans.md && (
          <>
            <Puces<Vue>
              libelle={t`Affichage de l’agenda`}
              valeur={vueChoisie}
              onChange={setVue}
              options={[
                {
                  valeur: 'liste',
                  libelle: t({
                    message: 'Liste',
                    comment: 'Affichage de l’agenda en liste',
                  }),
                },
                {
                  valeur: 'mois',
                  libelle: t({
                    message: 'Mois',
                    comment: 'Affichage de l’agenda en grille du mois',
                  }),
                },
              ]}
            />
            <SeparateurPuces />
          </>
        )}
        <PuceBascule actif={echeances} onChange={setEcheances}>
          <Trans>Échéances de mes périmètres</Trans>
        </PuceBascule>
        {vue === 'liste' && (
          <PuceBascule actif={passe} onChange={setPasse}>
            <Trans>Jours passés</Trans>
          </PuceBascule>
        )}
      </div>

      {!agenda ? (
        <Skeleton active />
      ) : (
        <DeuxColonnes
          cote={
            <>
              <Panneau titre={t`Phases`}>
                <ul className="rt-agenda-liste">
                  {phases.map(p => (
                    <li
                      key={p.cle}
                      className={`rt-agenda-phase-ligne${couvre(p, aujourdhui) ? ' rt-agenda-en-cours' : ''}`}
                    >
                      <span style={{ fontWeight: 600 }}>{p.titre}</span>
                      <span className="rt-note">
                        {libelleJours(p.jour, p.jourFin)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panneau>
              <Panneau
                titre={t`Dates clés`}
                extra={
                  agenda.peutGerer && (
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setSaisie('nouvelle')}
                    >
                      <Trans>Ajouter</Trans>
                    </Button>
                  )
                }
              >
                {datesCles.length === 0 ? (
                  <p className="rt-texte-secondaire">
                    {agenda.peutGerer
                      ? t`Ajoutez les jours qui comptent pour toute l’équipe ${periodeDe} : un dossier à déposer, une assemblée, une visite.`
                      : t`Les admins de l’activité n’ont placé aucune date clé dans ${periodeCette}.`}
                  </p>
                ) : (
                  <ul className="rt-agenda-liste">
                    {datesCles.map(d => (
                      <li key={d.cle} className="rt-agenda-compacte">
                        <span className="rt-agenda-compacte-texte">
                          <span style={{ fontWeight: 600 }}>{d.titre}</span>
                          <span className="rt-note">
                            {libelleJours(d.jour, d.jourFin)}
                          </span>
                        </span>
                        {gestesDateCle(d)}
                      </li>
                    ))}
                  </ul>
                )}
              </Panneau>
              {((sondages?.sondages.length ?? 0) > 0 ||
                agendasEcrits.length > 0) && (
                <Panneau
                  titre={t`Sondages de dates`}
                  extra={
                    agendasEcrits.length > 0 && (
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() =>
                          setNouveauSondage({
                            perimetreId: agendasEcrits[0]?.perimetreId ?? null,
                          })
                        }
                      >
                        {t({
                          message: 'Nouveau',
                          comment: 'Bouton : créer un sondage de dates',
                        })}
                      </Button>
                    )
                  }
                >
                  {(sondages?.sondages ?? []).length === 0 ? (
                    <p className="rt-texte-secondaire">
                      <Trans>
                        Un sondage propose plusieurs créneaux, puis donne la
                        réunion qui convient au plus grand nombre.
                      </Trans>
                    </p>
                  ) : (
                    <ul className="rt-liste-liens">
                      {(sondages?.sondages ?? []).map(s => {
                        const repondants = s.repondants
                        const participants = s.participants
                        return (
                          <li key={s.id}>
                            <button
                              type="button"
                              className="rt-ligne-lien"
                              style={{ fontSize: 13.5 }}
                              onClick={() => ouvrir('sondage', s.id)}
                            >
                              <span className="rt-agenda-compacte-texte">
                                <span>{s.titre}</span>
                                <span
                                  className="rt-note"
                                  style={{ fontWeight: 400 }}
                                >
                                  {s.statut === 'CLOS'
                                    ? t({
                                        message: 'Clos',
                                        comment: 'Statut d’un sondage',
                                      })
                                    : s.estParticipant && !s.aRepondu
                                      ? t`À vous de répondre`
                                      : t`${repondants} sur ${participants} réponses`}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Panneau>
              )}
              {/* L'abonnement partagé suit l'administration de l'activité, pas
                  la période affichée : il reste là sur une période archivée. */}
              {gere && (
                <AbonnementActivite
                  activiteId={activite.id}
                  nom={activite.nom}
                />
              )}
            </>
          }
        >
          {vue === 'mois' ? grille : listeParMois}
        </DeuxColonnes>
      )}

      {editionId && (
        <>
          <DateCleFormulaire
            editionId={editionId}
            dateCle={saisie}
            onFermer={() => setSaisie(null)}
          />
          <ReunionFormulaire
            editionId={editionId}
            agendas={agendasEcrits}
            reunion={nouvelleReunion}
            onFermer={() => setNouvelleReunion(null)}
          />
        </>
      )}
      {editionId && (
        <SondageFormulaire
          editionId={editionId}
          agendas={agendasEcrits}
          sondage={nouveauSondage}
          onFermer={() => setNouveauSondage(null)}
        />
      )}
      <SondageDetail
        // Un autre sondage repart d'un volet neuf, même ouvert par « Précédent ».
        key={sondageOuvert ?? 'aucun'}
        sondageId={sondageOuvert}
        agendas={agendasEcrits}
        onFermer={() => ouvrir('sondage', null)}
      />
      <ReunionDetail
        reunionId={reunionOuverte}
        agendas={agendasEcrits}
        onFermer={() => ouvrirReunion(null)}
      />
    </>
  )
}
