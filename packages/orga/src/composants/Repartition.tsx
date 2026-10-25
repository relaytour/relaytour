import { CloseOutlined, HolderOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
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
  Tooltip,
} from 'antd'
import { useMemo, useState, type DragEvent } from 'react'

import { graphql } from '../gql'
import type { BenevolesARepartirQuery, ProgrammeQuery } from '../gql/graphql'
import type { AgendaEcrit } from '../lib/agendas-ecrits'
import { messageErreur } from '../lib/erreurs'
import { libelleJours } from '../lib/agenda'
import { heureCourte, minutes, segmentDuJour } from '../lib/programme'
import {
  avertissements,
  axeDuJour,
  chevauchent,
  enManque,
  intervalleAbsolu,
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
  query CouvertureProgramme(
    $editionId: ID!
    $perimetreIds: [ID!]
    $sansPerimetre: Boolean
  ) {
    couvertureProgramme(
      editionId: $editionId
      perimetreIds: $perimetreIds
      sansPerimetre: $sansPerimetre
    ) {
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

const ADEQUATION: Record<
  'TOTALE' | 'PARTIELLE' | 'AUCUNE',
  { libelle: MessageDescriptor; couleur: string }
> = {
  TOTALE: {
    libelle: msg({
      message: 'Disponible',
      comment: 'Une personne est libre sur toute la séquence',
    }),
    couleur: 'success',
  },
  PARTIELLE: {
    libelle: msg({
      message: 'En partie',
      comment: 'Une personne est libre sur une partie de la séquence',
    }),
    couleur: 'warning',
  },
  AUCUNE: {
    libelle: msg({
      message: 'Hors plages',
      comment: 'Une personne n’est libre à aucun moment de la séquence',
    }),
    couleur: 'default',
  },
}

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
  const barre = (
    <span
      className={className}
      // Une barre qui porte des effectifs s'atteint au clavier, et son
      // libellé se lit au survol, au focus, à l'appui et par un lecteur d'écran.
      tabIndex={titre ? 0 : undefined}
      role={titre ? 'img' : undefined}
      aria-label={titre}
      style={{
        left: `${gauche}%`,
        width: `${largeur}%`,
        ...(couleur ? { background: couleur } : {}),
      }}
    />
  )
  return titre ? (
    <Tooltip title={titre} trigger={['hover', 'focus', 'click']}>
      {barre}
    </Tooltip>
  ) : (
    barre
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
  const { t } = useLingui()
  const ecrans = Grid.useBreakpoint()
  const admin = agendas.some(a => a.perimetreId === null)
  // Tant que la personne n'a rien choisi, le filtre suit ses agendas : ils
  // arrivent parfois après la première lecture de la vue.
  const [filtreChoisi, setFiltre] = useState<string[] | null>(null)
  const filtre =
    filtreChoisi ??
    (admin ? [TOUS] : agendas.map(a => a.perimetreId ?? SANS_PERIMETRE))
  const [regroupement, setRegroupement] = useState<'perimetre' | 'lieu'>(
    'perimetre'
  )
  const [choisie, setChoisie] = useState<string | null>(null)
  const [glisse, setGlisse] = useState<string | null>(null)

  const tous = filtre.includes(TOUS)
  // Le filtre dérivé change d'objet à chaque rendu : sa clé garde le calcul.
  const cleFiltre = filtre.join(',')
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
    [sequences, jour, cleFiltre]
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
      // « Toute l'activité » retient les séquences sans périmètre, comme la frise.
      sansPerimetre: !tous && filtre.includes(SANS_PERIMETRE),
    },
    fetchPolicy: 'cache-and-network',
  })
  const relire = { refetchQueries: RELIRE }
  const [placer, placement] = useMutation(PLACER, relire)
  const [retirer] = useMutation(RETIRER, relire)

  const parId = new Map(sequences.map(s => [s.id, s] as const))
  const personnes = data?.benevolesARepartir ?? []
  const tranches = (couverture?.couvertureProgramme ?? []).filter(
    tranche => tranche.jour === jour
  )
  const libelleRetrait = (nom: string, titre: string) =>
    t`Retirer ${nom} de « ${titre} »`

  // Les plages du jour affiché, pour dessiner la piste de la personne.
  const plagesDuJour = (p: Personne) => intervallesDuJour(p.plages, jour)
  // Les horaires entiers, pour les avertissements : une séquence de nuit se
  // compare au-delà de minuit.
  const horairesDe = (p: Personne) => ({
    plages: p.plages.map(intervalleAbsolu),
    places: p.places.flatMap(pl => {
      const s = parId.get(pl.sequenceId)
      return s ? [intervalleAbsolu(s)] : []
    }),
  })

  const executerPlacement = async (p: Personne, s: Sequence) => {
    const nomPersonne = p.nom
    const titreSequence = s.titre
    try {
      await placer({
        variables: {
          sequenceId: s.id,
          // Une candidature en attente passe en premier : le placement accepte
          // son choix et recalcule son statut, même quand une fiche existe déjà.
          candidatureId: p.candidatureId,
          benevoleId: p.candidatureId ? null : p.benevoleId,
        },
      })
      message.success(
        t`${nomPersonne} est placé·e dans « ${titreSequence} ». La place attend sa confirmation si la personne reçoit les mails.`
      )
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const proposerPlacement = (p: Personne, s: Sequence) => {
    const liste = avertissements({
      sequence: intervalleAbsolu(s),
      ...horairesDe(p),
      besoin: s.besoinBenevoles,
      renforts: s.renforts,
    })
    if (liste.length === 0) {
      void executerPlacement(p, s)
      return
    }
    const nomPersonne = p.nom
    const titreSequence = s.titre
    void modal.confirm({
      title: t`Placer ${nomPersonne} dans « ${titreSequence} » ?`,
      content: (
        <ul className="rt-liste-simple">
          {liste.map(a => (
            <li key={a}>{t(LIBELLES_AVERTISSEMENT[a])}</li>
          ))}
        </ul>
      ),
      okText: t`Placer quand même`,
      cancelText: t`Annuler`,
      onOk: () => executerPlacement(p, s),
    })
  }

  const confirmerRetrait = (s: Sequence, placeId: string, nom: string) => {
    const titreSequence = s.titre
    void modal.confirm({
      title: t`Retirer ${nom} de « ${titreSequence} » ?`,
      content: t`La personne revient dans les bénévoles à répartir. Une adresse confirmée reçoit le mail de ses places.`,
      okText: t`Retirer`,
      okButtonProps: { danger: true },
      cancelText: t`Annuler`,
      onOk: async () => {
        try {
          await retirer({ variables: { id: placeId } })
          message.success(t`Place retirée.`)
        } catch (e) {
          message.error(messageErreur(e))
        }
      },
    })
  }

  const deposer = (s: Sequence) => (e: DragEvent) => {
    e.preventDefault()
    const cle = e.dataTransfer.getData('text/plain')
    setGlisse(null)
    const p = personnes.find(x => x.cle === cle)
    if (p) proposerPlacement(p, s)
  }

  const libellePlage = (pl: Personne['plages'][number]) => {
    const jourDebut = libelleJours(pl.jour)
    const debut = pl.heureDebut
    const fin = pl.heureFin
    if (pl.jourFin !== pl.jour) {
      const jourFin = libelleJours(pl.jourFin)
      return t`${jourDebut}, ${debut} → ${jourFin}, ${fin}`
    }
    return t`${jourDebut}, ${debut} → ${fin}`
  }

  const details = (p: Personne) => {
    const origine = p.origine
    return (
      <div className="rt-repartition-details">
        {p.plages.length > 0 && (
          <p>
            <span className="rt-libelle">
              <Trans comment="Les plages où la personne est libre">
                Disponible
              </Trans>
            </span>{' '}
            {p.plages.map(libellePlage).join(' ; ')}
          </p>
        )}
        {p.precisionsDisponibilite && (
          <p>
            <span className="rt-libelle">
              <Trans>Précisions</Trans>
            </span>{' '}
            {p.precisionsDisponibilite}
          </p>
        )}
        {p.message && (
          <p>
            <span className="rt-libelle">
              <Trans>Message</Trans>
            </span>{' '}
            {p.message}
          </p>
        )}
        {p.note && (
          <p>
            <span className="rt-libelle">
              <Trans>Note</Trans>
            </span>{' '}
            {p.note}
          </p>
        )}
        {origine && (
          <p className="rt-note">
            <Trans>Candidature : {origine}</Trans>
          </p>
        )}
        {p.choix.length > 0 && (
          <p>
            <span className="rt-libelle">
              <Trans>A choisi</Trans>
            </span>{' '}
            {p.choix
              .map(c => parId.get(c.sequenceId)?.titre)
              .filter(Boolean)
              .join(', ')}
          </p>
        )}
        {p.places.length > 0 && (
          <p>
            <span className="rt-libelle">
              <Trans>Placé·e</Trans>
            </span>{' '}
            {p.places
              .map(pl => parId.get(pl.sequenceId)?.titre)
              .filter(Boolean)
              .join(', ')}
          </p>
        )}
        {p.ouAilleurs && (
          <p className="rt-note">
            <Trans>Aide là où il manque du monde.</Trans>
          </p>
        )}
      </div>
    )
  }

  const lignePersonne = (p: Personne, mobile = false) => {
    const plages = plagesDuJour(p)
    const choisieIci =
      selection !== null && p.choix.some(c => c.sequenceId === selection.s.id)
    const attente =
      selection !== null &&
      p.choix.some(
        c => c.sequenceId === selection.s.id && c.statut === 'LISTE_ATTENTE'
      )
    const occupe =
      selection !== null &&
      horairesDe(p).places.some(pl =>
        chevauchent(pl, intervalleAbsolu(selection.s))
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
              {t(ADEQUATION[p.adequation].libelle)}
            </Tag>
          )}
          {choisieIci && <Tag color="processing">{t`A choisi`}</Tag>}
          {attente && <Tag color="warning">{t`Liste d’attente`}</Tag>}
          {occupe && <Tag color="error">{t`Déjà placé·e`}</Tag>}
          {selection !== null && ecrite(selection.s) && (
            <Button
              size="small"
              type="primary"
              className="rt-repartition-placer"
              loading={placement.loading}
              onClick={() => proposerPlacement(p, selection.s)}
            >
              <Trans>Placer</Trans>
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

  const horaireDe = (s: Sequence) => {
    const debut = s.heureDebut
    const fin = s.heureFin
    if (!s.lieu) return t`${debut} → ${fin}`
    const nomLieu = s.lieu.nom
    return t`${debut} → ${fin} · ${nomLieu}`
  }

  const panneau = (mobile = false) => {
    const titreSequence = selection?.s.titre
    const debut = selection?.s.heureDebut
    const fin = selection?.s.heureFin
    const intitulePourSequence = t`Pour « ${titreSequence} », ${debut} → ${fin}`
    return (
      <section
        className="rt-repartition-panneau"
        aria-label={t`Bénévoles à répartir`}
      >
        <h3 className="rt-reunion-intertitre">
          {selection ? intitulePourSequence : t`Bénévoles à répartir`}
        </h3>
        {!selection && (
          <p className="rt-note">
            <Trans>
              Choisissez une séquence pour classer les personnes selon leurs
              disponibilités.
            </Trans>
          </p>
        )}
        {loading && !data ? (
          <Skeleton active />
        ) : personnes.length === 0 ? (
          <Empty description={t`Personne n’attend de place.`} />
        ) : (
          <ul className="rt-repartition-personnes">
            {personnes.map(p => lignePersonne(p, mobile))}
          </ul>
        )}
      </section>
    )
  }

  const filtres = (
    <div className="rt-repartition-filtres">
      <Select
        mode="multiple"
        aria-label={t`Périmètres`}
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
          ...(admin ? [{ value: TOUS, label: t`Tous les périmètres` }] : []),
          ...agendas.map(a => ({
            value: a.perimetreId ?? SANS_PERIMETRE,
            label: a.perimetreId ? a.nom : t`Toute l’activité`,
          })),
        ]}
      />
      {ecrans.md && (
        <Segmented<'perimetre' | 'lieu'>
          value={regroupement}
          onChange={v => setRegroupement(v)}
          options={[
            { value: 'perimetre', label: t`Par périmètre` },
            { value: 'lieu', label: t`Par lieu` },
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
          <Empty
            description={t`Aucune séquence de ce jour ne manque de bénévoles.`}
          />
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
                  <span className="rt-note">{horaireDe(s)}</span>
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
        ? (d.s.perimetre?.nom ?? t`Toute l’activité`)
        : (d.s.lieu?.nom ?? t`Sans lieu`)
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
        <Empty
          description={t`Aucune séquence de ce jour ne cherche de bénévoles. Fixez des renforts recherchés dans une séquence.`}
        />
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
              aria-label={t`Couverture par tranche de 30 minutes`}
            >
              <span className="rt-note">
                <Trans comment="Le bandeau qui montre les effectifs par tranche de 30 minutes">
                  Couverture
                </Trans>
              </span>
              <div className="rt-repartition-piste rt-repartition-bandeau">
                {tranches.map(tranche => {
                  const debut = minutes(tranche.heure)
                  const manque = enManque(tranche)
                  const { heure, besoin, confirmees, aConfirmer, disponibles } =
                    tranche
                  const libelle = t`${heure} : besoin ${besoin}, ${plural(confirmees, { one: '# confirmée', other: '# confirmées' })}, ${aConfirmer} à confirmer, ${plural(disponibles, { one: '# disponible', other: '# disponibles' })}`
                  return (
                    <Barre
                      key={tranche.heure}
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
                          <Trans>Détail</Trans>
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
                                      aria-label={libelleRetrait(
                                        p.nom,
                                        s.titre
                                      )}
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
