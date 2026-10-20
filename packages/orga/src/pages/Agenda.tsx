import { useMutation, useQuery } from '@apollo/client/react'
import {
  DeleteOutlined,
  EditOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { App, Button, Empty, Grid, Result, Skeleton } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import ChoixEdition from '../composants/ChoixEdition'
import DateCleFormulaire, {
  type DateCleSaisie,
} from '../composants/DateCleFormulaire'
import { DeuxColonnes, Panneau, Section } from '../composants/Panneau'
import PastillePerimetre from '../composants/PastillePerimetre'
import { PuceBascule, Puces, SeparateurPuces } from '../composants/Puces'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { AgendaQuery, SorteElementAgenda } from '../gql/graphql'
import {
  couvre,
  decalerMois,
  grilleDuMois,
  grouperParMoisAgenda,
  JOURS_DE_LA_SEMAINE,
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

const AGENDA = graphql(`
  query Agenda($editionId: ID!, $echeances: Boolean) {
    agenda(editionId: $editionId, echeances: $echeances) {
      peutGerer
      edition {
        id
        nom
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

const SUPPRIMER = graphql(`
  mutation SupprimerDateCle($id: ID!) {
    supprimerDateCle(id: $id)
  }
`)

type Element = AgendaQuery['agenda']['elements'][number]
type Vue = 'liste' | 'mois'
const VUES = ['liste', 'mois'] as const
/** Clé de l'affichage de l'agenda, gardé dans le navigateur. */
const CLE_VUE_AGENDA = 'relaytour.agenda.vue'

const LIBELLES_SORTES: Record<SorteElementAgenda, string> = {
  PHASE: 'Phase',
  DEBUT_PERIODE: 'Période',
  FIN_PERIODE: 'Période',
  DATE_CLE: 'Date clé',
  ECHEANCE: 'Échéance',
}

const majuscule = (texte: string) =>
  texte.charAt(0).toUpperCase() + texte.slice(1)

const compteElements = (n: number) => `${n} ${n > 1 ? 'éléments' : 'élément'}`

export default function Agenda() {
  const { lien, periode } = useActivite()
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
  const { data, error } = useQuery(AGENDA, {
    variables: { editionId: editionId ?? '', echeances },
    skip: editionId === undefined,
    fetchPolicy: 'cache-and-network',
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
  const groupes = useMemo(
    () => grouperParMoisAgenda(elements, passe ? null : aujourdhui),
    [elements, passe, aujourdhui]
  )

  if (editionId === undefined && courante && !courante.editionCourante) {
    return (
      <Result status="info" title={`${periode.Aucune} n’est en préparation.`} />
    )
  }
  if (error && !data) {
    return (
      <Result
        status="warning"
        title="L’agenda n’a pas pu être chargé."
        subTitle="Rechargez la page dans un instant."
      />
    )
  }

  const confirmerSuppression = (element: Element) => {
    if (!element.dateCleId) return
    const id = element.dateCleId
    void modal.confirm({
      title: 'Supprimer cette date clé ?',
      content: `« ${element.titre} » disparaît de l’agenda de chaque personne.`,
      okText: 'Supprimer',
      okButtonProps: { danger: true },
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          await supprimer({ variables: { id } })
          message.success('Date clé supprimée.')
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })
  }

  const modifier = (element: Element) =>
    element.dateCleId &&
    setSaisie({
      id: element.dateCleId,
      titre: element.titre,
      jour: element.jour,
      jourFin: element.jourFin,
      description: element.description,
      version: element.version ?? 0,
    })

  const gestesDateCle = (element: Element) =>
    agenda?.peutGerer &&
    element.sorte === 'DATE_CLE' && (
      <span className="rt-agenda-gestes">
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          aria-label={`Modifier « ${element.titre} »`}
          onClick={() => modifier(element)}
        />
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          aria-label={`Supprimer « ${element.titre} »`}
          onClick={() => confirmerSuppression(element)}
        />
      </span>
    )

  const titreElement = (element: Element) => {
    const perimetre = element.perimetreId
      ? perimetreDe.get(element.perimetreId)
      : undefined
    if (element.sorte === 'ECHEANCE' && perimetre) {
      return (
        <Link
          to={lien(`/perimetres/${perimetre.slug}?edition=${editionId}`)}
          className={element.faite ? 'rt-agenda-faite' : undefined}
        >
          {element.titre}
        </Link>
      )
    }
    return <span>{element.titre}</span>
  }

  const ligne = (element: Element) => {
    const perimetre = element.perimetreId
      ? perimetreDe.get(element.perimetreId)
      : undefined
    return (
      <li
        key={element.cle}
        className={`rt-agenda-ligne rt-agenda-${element.sorte.toLowerCase()}`}
      >
        <span className="rt-agenda-jour">
          {libelleJours(element.jour, element.jourFin)}
        </span>
        <span className="rt-agenda-corps">
          <span className="rt-agenda-sorte">
            {LIBELLES_SORTES[element.sorte]}
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
              ? `L’agenda ${periode.de} est vide.`
              : 'Aucune date à venir dans l’agenda.'
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

  const elementsDuMois = elements.filter(
    e => e.sorte !== 'PHASE' && toucheLeMois(e, mois)
  )
  const phasesDuMois = phases.filter(p => toucheLeMois(p, mois))
  const grille = (
    <Section
      titre={majuscule(libelleMois(mois))}
      compte={compteElements(elementsDuMois.length)}
      extra={
        <span className="rt-agenda-navigation">
          <Button
            size="small"
            icon={<LeftOutlined />}
            aria-label="Mois précédent"
            onClick={() => setMois(m => decalerMois(m, -1))}
          />
          <Button size="small" onClick={() => setMois(aujourdhui.slice(0, 7))}>
            Aujourd’hui
          </Button>
          <Button
            size="small"
            icon={<RightOutlined />}
            aria-label="Mois suivant"
            onClick={() => setMois(m => decalerMois(m, 1))}
          />
        </span>
      }
    >
      {phasesDuMois.length > 0 && (
        <p className="rt-note" style={{ margin: '0 6px' }}>
          {phasesDuMois.length > 1 ? 'Phases' : 'Phase'} :{' '}
          {phasesDuMois
            .map(p => `${p.titre} (${libelleJours(p.jour, p.jourFin)})`)
            .join(', ')}
        </p>
      )}
      <div className="rt-agenda-grille" role="grid" aria-label="Jours du mois">
        <div role="row" className="rt-agenda-semaine">
          {JOURS_DE_LA_SEMAINE.map(j => (
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
                  {duJour.map(e => (
                    <span
                      key={e.cle}
                      className={`rt-agenda-evenement rt-agenda-${e.sorte.toLowerCase()}`}
                      title={`${LIBELLES_SORTES[e.sorte]} · ${e.titre}`}
                    >
                      {e.titre}
                    </span>
                  ))}
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
        sousTitre={`Les phases, les dates clés et les échéances ${periode.de}.`}
        actions={
          <ChoixEdition
            valeur={editionId}
            onChange={id => setParametres({ edition: id })}
          />
        }
      >
        Agenda
      </Titre>

      <div className="rt-puces" style={{ marginBottom: 22, rowGap: 10 }}>
        {ecrans.md && (
          <>
            <Puces<Vue>
              libelle="Affichage de l’agenda"
              valeur={vueChoisie}
              onChange={setVue}
              options={[
                { valeur: 'liste', libelle: 'Liste' },
                { valeur: 'mois', libelle: 'Mois' },
              ]}
            />
            <SeparateurPuces />
          </>
        )}
        <PuceBascule actif={echeances} onChange={setEcheances}>
          Échéances de mes périmètres
        </PuceBascule>
        {vue === 'liste' && (
          <PuceBascule actif={passe} onChange={setPasse}>
            Jours passés
          </PuceBascule>
        )}
      </div>

      {!agenda ? (
        <Skeleton active />
      ) : (
        <DeuxColonnes
          cote={
            <>
              <Panneau titre="Phases">
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
                titre="Dates clés"
                extra={
                  agenda.peutGerer && (
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => setSaisie('nouvelle')}
                    >
                      Ajouter
                    </Button>
                  )
                }
              >
                {datesCles.length === 0 ? (
                  <p className="rt-texte-secondaire">
                    {agenda.peutGerer
                      ? `Ajoutez les jours qui comptent pour toute l’équipe ${periode.de} : un dossier à déposer, une assemblée, une visite.`
                      : `Les admins de l’activité n’ont placé aucune date clé dans ${periode.cette}.`}
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
            </>
          }
        >
          {vue === 'mois' ? grille : listeParMois}
        </DeuxColonnes>
      )}

      {editionId && (
        <DateCleFormulaire
          editionId={editionId}
          dateCle={saisie}
          onFermer={() => setSaisie(null)}
        />
      )}
    </>
  )
}
