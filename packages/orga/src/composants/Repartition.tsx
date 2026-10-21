import { CloseOutlined, HolderOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  App,
  Button,
  Drawer,
  Empty,
  Grid,
  Popover,
  Segmented,
  Select,
  Skeleton,
  Tag,
} from 'antd'
import { useMemo, useState, type DragEvent } from 'react'

import { graphql } from '../gql'
import type { BenevolesARepartirQuery, ProgrammeQuery } from '../gql/graphql'
import type { AgendaEcrit } from '../lib/agendas-ecrits'
import { messageErreur } from '../lib/erreurs'
import { heureCourte, minutes, segmentDuJour } from '../lib/programme'
import {
  avertissements,
  axeDuJour,
  enManque,
  intervallesDuJour,
  LIBELLES_AVERTISSEMENT,
  position,
  type Intervalle,
} from '../lib/repartition'

import { EtatPlace, Jauge } from './Jauge'

// Vue « Répartition » du programme (ADR 0041). Un bandeau montre les manques par
// tranche de 30 minutes ; une frise montre les séquences qui cherchent des
// bénévoles ; un panneau montre les personnes à répartir sur le même axe des
// heures. L'équipe place une personne par glisser-déposer, ou par le bouton
// « Placer », accessible au clavier et au doigt. Sur un téléphone, la vue liste
// les séquences en manque.

const A_REPARTIR = graphql(`
  query BenevolesARepartir($editionId: ID!, $sequenceId: ID) {
    benevolesARepartir(editionId: $editionId, sequenceId: $sequenceId) {
      cle
      candidatureId
      benevoleId
      nom
      precisionsDisponibilite
      message
      origine
      ouAilleurs
      adequation
      note
      plages {
        jour
        heureDebut
        jourFin
        heureFin
      }
      choix {
        sequenceId
        statut
      }
      places {
        sequenceId
      }
    }
  }
`)

const COUVERTURE = graphql(`
  query CouvertureProgramme($editionId: ID!, $perimetreIds: [ID!]) {
    couvertureProgramme(editionId: $editionId, perimetreIds: $perimetreIds) {
      jour
      heure
      besoin
      confirmees
      aConfirmer
      disponibles
    }
  }
`)

const PLACER = graphql(`
  mutation PlacerBenevole(
    $sequenceId: ID!
    $candidatureId: ID
    $benevoleId: ID
  ) {
    placerBenevole(
      sequenceId: $sequenceId
      candidatureId: $candidatureId
      benevoleId: $benevoleId
    ) {
      id
    }
  }
`)

const RETIRER = graphql(`
  mutation RetirerPlaceSequence($id: ID!) {
    retirerPlaceSequence(id: $id) {
      id
    }
  }
`)

type Sequence = ProgrammeQuery['programme'][number]
type Personne = BenevolesARepartirQuery['benevolesARepartir'][number]

const RELIRE = [
  'Programme',
  'BenevolesARepartir',
  'CouvertureProgramme',
  'Candidatures',
  'Benevoles',
]

const ADEQUATION = {
  TOTALE: { libelle: 'Disponible', couleur: 'success' },
  PARTIELLE: { libelle: 'En partie', couleur: 'warning' },
  AUCUNE: { libelle: 'Hors plages', couleur: 'default' },
} as const

const TOUS = '__tous'
const SANS_PERIMETRE = '__activite'

/** Une barre placée sur l'axe des heures. */
function Barre({
  intervalle,
  axe,
  className,
  titre,
  couleur,
}: {
  intervalle: Intervalle
  axe: Intervalle
  className: string
  titre?: string
  couleur?: string
}) {
  const { gauche, largeur } = position(intervalle, axe)
  return (
    <span
      className={className}
      title={titre}
      style={{
        left: `${gauche}%`,
        width: `${largeur}%`,
        ...(couleur ? { background: couleur } : {}),
      }}
    />
  )
}

export default function Repartition({
  editionId,
  jour,
  sequences,
  agendas,
  onOuvrir,
}: {
  editionId: string
  jour: string
  sequences: readonly Sequence[]
  agendas: readonly AgendaEcrit[]
  onOuvrir: (sequenceId: string) => void
}) {
  const { message, modal } = App.useApp()
  const ecrans = Grid.useBreakpoint()
  const admin = agendas.some(a => a.perimetreId === null)
  const [filtre, setFiltre] = useState<string[]>(
    admin ? [TOUS] : agendas.map(a => a.perimetreId ?? SANS_PERIMETRE)
  )
  const [regroupement, setRegroupement] = useState<'perimetre' | 'lieu'>(
    'perimetre'
  )
  const [choisie, setChoisie] = useState<string | null>(null)
  const [glisse, setGlisse] = useState<string | null>(null)

  const tous = filtre.includes(TOUS)
  const retenue = (s: Sequence) =>
    tous || filtre.includes(s.perimetre?.id ?? SANS_PERIMETRE)
  const ecrite = (s: Sequence) =>
    agendas.some(a => a.perimetreId === (s.perimetre?.id ?? null))

  // Les séquences du jour qui cherchent des bénévoles, dans le filtre.
  const duJour = useMemo(
    () =>
      sequences
        .filter(s => s.besoinBenevoles !== null && retenue(s))
        .flatMap(s => {
          const segment = segmentDuJour(s, jour)
          return segment === null ? [] : [{ s, segment }]
        })
        .sort((a, b) => a.segment.debut - b.segment.debut),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sequences, jour, filtre]
  )
  const axe = axeDuJour(duJour.map(d => d.segment))
  const selection = duJour.find(d => d.s.id === choisie) ?? null

  const { data, loading } = useQuery(A_REPARTIR, {
    variables: { editionId, sequenceId: selection?.s.id ?? null },
    fetchPolicy: 'cache-and-network',
  })
  const { data: couverture } = useQuery(COUVERTURE, {
    variables: {
      editionId,
      perimetreIds: tous
        ? null
        : filtre.filter(f => f !== SANS_PERIMETRE && f !== TOUS),
    },
    fetchPolicy: 'cache-and-network',
  })
  const relire = { refetchQueries: RELIRE }
  const [placer, placement] = useMutation(PLACER, relire)
  const [retirer] = useMutation(RETIRER, relire)

  const parId = new Map(sequences.map(s => [s.id, s] as const))
  const personnes = data?.benevolesARepartir ?? []
  const tranches = (couverture?.couvertureProgramme ?? []).filter(
    t => t.jour === jour
  )

  const intervallesDe = (p: Personne) => ({
    plages: intervallesDuJour(p.plages, jour),
    places: p.places.flatMap(pl => {
      const s = parId.get(pl.sequenceId)
      const segment = s ? segmentDuJour(s, jour) : null
      return segment ? [segment] : []
    }),
  })

  const executerPlacement = async (p: Personne, s: Sequence) => {
    try {
      await placer({
        variables: {
          sequenceId: s.id,
          candidatureId: p.benevoleId ? null : p.candidatureId,
          benevoleId: p.benevoleId,
        },
      })
      message.success(
        `${p.nom} est placé·e dans « ${s.titre} ». La place attend sa confirmation si la personne reçoit les mails.`
      )
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const proposerPlacement = (p: Personne, s: Sequence) => {
    const segment = segmentDuJour(s, jour)
    if (segment === null) return
    const liste = avertissements({
      sequence: segment,
      ...intervallesDe(p),
      besoin: s.besoinBenevoles,
      renforts: s.renforts,
    })
    if (liste.length === 0) {
      void executerPlacement(p, s)
      return
    }
    void modal.confirm({
      title: `Placer ${p.nom} dans « ${s.titre} » ?`,
      content: (
        <ul className="rt-liste-simple">
          {liste.map(a => (
            <li key={a}>{LIBELLES_AVERTISSEMENT[a]}</li>
          ))}
        </ul>
      ),
      okText: 'Placer quand même',
      cancelText: 'Annuler',
      onOk: () => executerPlacement(p, s),
    })
  }

  const confirmerRetrait = (s: Sequence, placeId: string, nom: string) =>
    void modal.confirm({
      title: `Retirer ${nom} de « ${s.titre} » ?`,
      content:
        'La personne revient dans les bénévoles à répartir. Une adresse confirmée reçoit le mail de ses places.',
      okText: 'Retirer',
      okButtonProps: { danger: true },
      cancelText: 'Annuler',
      onOk: async () => {
        try {
          await retirer({ variables: { id: placeId } })
          message.success('Place retirée.')
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })

  const deposer = (s: Sequence) => (e: DragEvent) => {
    e.preventDefault()
    const cle = e.dataTransfer.getData('text/plain')
    setGlisse(null)
    const p = personnes.find(x => x.cle === cle)
    if (p) proposerPlacement(p, s)
  }

  const details = (p: Personne) => (
    <div className="rt-repartition-details">
      {p.precisionsDisponibilite && (
        <p>
          <span className="rt-libelle">Précisions</span>{' '}
          {p.precisionsDisponibilite}
        </p>
      )}
      {p.message && (
        <p>
          <span className="rt-libelle">Message</span> {p.message}
        </p>
      )}
      {p.note && (
        <p>
          <span className="rt-libelle">Note</span> {p.note}
        </p>
      )}
      {p.origine && <p className="rt-note">Candidature : {p.origine}</p>}
      {p.choix.length > 0 && (
        <p>
          <span className="rt-libelle">A choisi</span>{' '}
          {p.choix
            .map(c => parId.get(c.sequenceId)?.titre)
            .filter(Boolean)
            .join(', ')}
        </p>
      )}
      {p.places.length > 0 && (
        <p>
          <span className="rt-libelle">Placé·e</span>{' '}
          {p.places
            .map(pl => parId.get(pl.sequenceId)?.titre)
            .filter(Boolean)
            .join(', ')}
        </p>
      )}
      {p.ouAilleurs && (
        <p className="rt-note">Aide là où il manque du monde.</p>
      )}
    </div>
  )

  const lignePersonne = (p: Personne, mobile = false) => {
    const { plages } = intervallesDe(p)
    const choisieIci =
      selection !== null && p.choix.some(c => c.sequenceId === selection.s.id)
    const attente =
      selection !== null &&
      p.choix.some(
        c => c.sequenceId === selection.s.id && c.statut === 'LISTE_ATTENTE'
      )
    const occupe =
      selection !== null &&
      intervallesDe(p).places.some(
        pl =>
          pl.debut < selection.segment.fin && selection.segment.debut < pl.fin
      )
    return (
      <li
        key={p.cle}
        className="rt-repartition-personne"
        draggable={!mobile}
        onDragStart={e => {
          e.dataTransfer.setData('text/plain', p.cle)
          e.dataTransfer.effectAllowed = 'copy'
          setGlisse(p.cle)
        }}
        onDragEnd={() => setGlisse(null)}
      >
        <div className="rt-repartition-personne-tete">
          {!mobile && <HolderOutlined aria-hidden className="rt-poignee" />}
          <Popover
            trigger={['hover', 'click']}
            title={p.nom}
            content={details(p)}
          >
            <button type="button" className="rt-lien-texte">
              {p.nom}
            </button>
          </Popover>
          {p.adequation && (
            <Tag color={ADEQUATION[p.adequation].couleur}>
              {ADEQUATION[p.adequation].libelle}
            </Tag>
          )}
          {choisieIci && <Tag color="processing">A choisi</Tag>}
          {attente && <Tag color="warning">Liste d’attente</Tag>}
          {occupe && <Tag color="error">Déjà placé·e</Tag>}
          {selection !== null && ecrite(selection.s) && (
            <Button
              size="small"
              type="primary"
              className="rt-repartition-placer"
              loading={placement.loading}
              onClick={() => proposerPlacement(p, selection.s)}
            >
              Placer
            </Button>
          )}
        </div>
        {!mobile && (
          <div className="rt-repartition-piste" aria-hidden>
            {plages.map(pl => (
              <Barre
                key={`${pl.debut}-${pl.fin}`}
                intervalle={pl}
                axe={axe}
                className="rt-repartition-plage"
              />
            ))}
            {selection && (
              <Barre
                intervalle={selection.segment}
                axe={axe}
                className="rt-repartition-repere"
              />
            )}
          </div>
        )}
      </li>
    )
  }

  const panneau = (mobile = false) => (
    <section
      className="rt-repartition-panneau"
      aria-label="Bénévoles à répartir"
    >
      <h3 className="rt-reunion-intertitre">
        {selection
          ? `Pour « ${selection.s.titre} », ${selection.s.heureDebut} → ${selection.s.heureFin}`
          : 'Bénévoles à répartir'}
      </h3>
      {!selection && (
        <p className="rt-note">
          Choisissez une séquence pour classer les personnes selon leurs
          disponibilités.
        </p>
      )}
      {loading && !data ? (
        <Skeleton active />
      ) : personnes.length === 0 ? (
        <Empty description="Personne n’attend de place." />
      ) : (
        <ul className="rt-repartition-personnes">
          {personnes.map(p => lignePersonne(p, mobile))}
        </ul>
      )}
    </section>
  )

  const filtres = (
    <div className="rt-repartition-filtres">
      <Select
        mode="multiple"
        aria-label="Périmètres"
        style={{ minWidth: 220, maxWidth: '100%' }}
        value={filtre}
        onChange={v =>
          setFiltre(
            v.length === 0
              ? admin
                ? [TOUS]
                : []
              : v.includes(TOUS) && !filtre.includes(TOUS)
                ? [TOUS]
                : v.filter(x => x !== TOUS)
          )
        }
        options={[
          ...(admin ? [{ value: TOUS, label: 'Tous les périmètres' }] : []),
          ...agendas.map(a => ({
            value: a.perimetreId ?? SANS_PERIMETRE,
            label: a.perimetreId ? a.nom : 'Toute l’activité',
          })),
        ]}
      />
      {ecrans.md && (
        <Segmented<'perimetre' | 'lieu'>
          value={regroupement}
          onChange={v => setRegroupement(v)}
          options={[
            { value: 'perimetre', label: 'Par périmètre' },
            { value: 'lieu', label: 'Par lieu' },
          ]}
        />
      )}
    </div>
  )

  // ── Téléphone : la liste des séquences en manque ───────────────────────────
  if (!ecrans.md) {
    const enManqueIci = duJour.filter(
      d => d.s.renforts < (d.s.besoinBenevoles ?? 0)
    )
    return (
      <div className="rt-repartition">
        {filtres}
        {enManqueIci.length === 0 ? (
          <Empty description="Aucune séquence de ce jour ne manque de bénévoles." />
        ) : (
          <ul className="rt-repartition-manques">
            {enManqueIci.map(({ s }) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="rt-verre rt-repartition-manque"
                  onClick={() => setChoisie(s.id)}
                >
                  <strong>{s.titre}</strong>
                  <span className="rt-note">
                    {s.heureDebut} → {s.heureFin}
                    {s.lieu && ` · ${s.lieu.nom}`}
                  </span>
                  <Jauge renforts={s.renforts} besoin={s.besoinBenevoles!} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Drawer
          open={selection !== null}
          onClose={() => setChoisie(null)}
          title={selection?.s.titre}
          placement="bottom"
          size="large"
        >
          {panneau(true)}
        </Drawer>
      </div>
    )
  }

  // ── Ordinateur : bandeau, frise et panneau ─────────────────────────────────
  const groupes = new Map<string, { nom: string; lignes: typeof duJour }>()
  for (const d of duJour) {
    const cle =
      regroupement === 'perimetre'
        ? (d.s.perimetre?.id ?? SANS_PERIMETRE)
        : (d.s.lieu?.id ?? 'sans-lieu')
    const nom =
      regroupement === 'perimetre'
        ? (d.s.perimetre?.nom ?? 'Toute l’activité')
        : (d.s.lieu?.nom ?? 'Sans lieu')
    if (!groupes.has(cle)) groupes.set(cle, { nom, lignes: [] })
    groupes.get(cle)!.lignes.push(d)
  }
  // Une heure sur deux au-delà de huit heures d'axe : les libellés restent lisibles.
  const pas = axe.fin - axe.debut > 8 * 60 ? 120 : 60
  const heures: number[] = []
  for (let m = axe.debut; m <= axe.fin; m += pas) heures.push(m)

  return (
    <div className="rt-repartition">
      {filtres}
      {duJour.length === 0 ? (
        <Empty description="Aucune séquence de ce jour ne cherche de bénévoles. Fixez des renforts recherchés dans une séquence." />
      ) : (
        <div className="rt-repartition-corps">
          <div className="rt-verre rt-repartition-frise">
            <div className="rt-repartition-ligne rt-repartition-entete">
              <span />
              <div className="rt-repartition-piste">
                {heures.map(m => (
                  <span
                    key={m}
                    className="rt-repartition-heure"
                    style={{
                      left: `${position({ debut: m, fin: m }, axe).gauche}%`,
                    }}
                  >
                    {heureCourte(m)}
                  </span>
                ))}
              </div>
            </div>
            <div
              className="rt-repartition-ligne"
              aria-label="Couverture par tranche de 30 minutes"
            >
              <span className="rt-note">Couverture</span>
              <div className="rt-repartition-piste rt-repartition-bandeau">
                {tranches.map(t => {
                  const debut = minutes(t.heure)
                  const manque = enManque(t)
                  const libelle = `${t.heure} : besoin ${t.besoin}, ${t.confirmees} confirmée${t.confirmees > 1 ? 's' : ''}, ${t.aConfirmer} à confirmer, ${t.disponibles} disponible${t.disponibles > 1 ? 's' : ''}`
                  return (
                    <Barre
                      key={t.heure}
                      intervalle={{ debut, fin: debut + 30 }}
                      axe={axe}
                      className={`rt-repartition-tranche${manque ? ' rt-manque' : ''}`}
                      titre={libelle}
                    />
                  )
                })}
              </div>
            </div>
            {[...groupes.values()].map(g => (
              <div key={g.nom} className="rt-repartition-groupe">
                <h3 className="rt-libelle">{g.nom}</h3>
                {g.lignes.map(({ s, segment }) => {
                  const active = s.id === choisie
                  return (
                    <div
                      key={s.id}
                      className={`rt-repartition-ligne${active ? ' rt-active' : ''}${glisse && ecrite(s) ? ' rt-cible' : ''}`}
                      onDragOver={e => {
                        if (ecrite(s)) e.preventDefault()
                      }}
                      onDrop={ecrite(s) ? deposer(s) : undefined}
                    >
                      <div className="rt-repartition-sequence">
                        <button
                          type="button"
                          className="rt-lien-texte"
                          aria-pressed={active}
                          onClick={() => setChoisie(active ? null : s.id)}
                        >
                          {s.titre}
                        </button>
                        <span className="rt-note">
                          {s.heureDebut} → {s.heureFin}
                        </span>
                        <Jauge
                          renforts={s.renforts}
                          besoin={s.besoinBenevoles!}
                          court
                        />
                        <Button
                          type="link"
                          size="small"
                          onClick={() => onOuvrir(s.id)}
                        >
                          Détail
                        </Button>
                      </div>
                      <div className="rt-repartition-colonne">
                        <div className="rt-repartition-piste">
                          <Barre
                            intervalle={segment}
                            axe={axe}
                            className="rt-repartition-barre"
                            couleur={s.perimetre?.couleur ?? undefined}
                          />
                        </div>
                        {s.places.some(p => p.role === 'RENFORT') && (
                          <span className="rt-repartition-places">
                            {s.places
                              .filter(p => p.role === 'RENFORT')
                              .map(p => (
                                <span
                                  key={p.id}
                                  className="rt-repartition-place"
                                >
                                  {p.nom}
                                  {p.etat !== 'CONFIRMEE' && (
                                    <EtatPlace etat={p.etat} />
                                  )}
                                  {ecrite(s) && (
                                    <button
                                      type="button"
                                      className="rt-lien-texte"
                                      aria-label={`Retirer ${p.nom} de « ${s.titre} »`}
                                      onClick={() =>
                                        confirmerRetrait(s, p.id, p.nom)
                                      }
                                    >
                                      <CloseOutlined />
                                    </button>
                                  )}
                                </span>
                              ))}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="rt-verre">{panneau()}</div>
        </div>
      )}
    </div>
  )
}
