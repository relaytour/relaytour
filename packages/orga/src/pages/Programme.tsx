import { useQuery } from '@apollo/client/react'
import {
  EnvironmentOutlined,
  PlusOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import { Button, Empty, Grid, Result, Skeleton } from 'antd'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import ChoixEdition from '../composants/ChoixEdition'
import LieuxFenetre from '../composants/LieuxFenetre'
import { Section } from '../composants/Panneau'
import { Puces, SeparateurPuces } from '../composants/Puces'
import SequenceDetail, { type SequenceLue } from '../composants/SequenceDetail'
import SequenceFormulaire, {
  type NouvelleSequence,
  type SequenceSaisie,
} from '../composants/SequenceFormulaire'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { jourLocal, libelleJours } from '../lib/agenda'
import { useAgendasEcrits } from '../lib/agendas-ecrits'
import {
  grilleDuJour,
  heureCourte,
  joursDuProgramme,
  segmentDuJour,
  TRANCHE_MINUTES,
} from '../lib/programme'
import { EDITION_COURANTE, LIEUX } from '../lib/requetes'

const PROGRAMME = graphql(`
  query Programme($editionId: ID!, $mesSequences: Boolean) {
    programme(editionId: $editionId, mesSequences: $mesSequences) {
      id
      editionId
      titre
      description
      jour
      jourFin
      heureDebut
      heureFin
      version
      peutModifier
      perimetre {
        id
        nom
        couleur
      }
      lieu {
        id
        nom
      }
      places {
        id
        role
        personneId
        benevoleId
        nom
        estMoi
      }
    }
  }
`)

type Vue = 'grille' | 'liste' | 'moi'

/** Les personnes d'une séquence, responsables en tête, en une ligne. */
function personnes(s: SequenceLue): string {
  return s.places
    .map(p => (p.role === 'RESPONSABLE' ? `${p.nom} (resp.)` : p.nom))
    .join(', ')
}

/** Programme du jour J d'une période (ADR 0040). */
export default function Programme() {
  const { activite, gere, periode } = useActivite()
  const ecrans = Grid.useBreakpoint()
  const [parametres, setParametres] = useSearchParams()
  const { data: courante } = useQuery(EDITION_COURANTE)
  const editionId = parametres.get('edition') ?? courante?.editionCourante?.id
  const vueDemandee = (parametres.get('vue') as Vue | null) ?? 'grille'
  const vue: Vue =
    vueDemandee === 'grille' && !ecrans.md ? 'liste' : vueDemandee
  const { data, error } = useQuery(PROGRAMME, {
    variables: { editionId: editionId ?? '', mesSequences: vue === 'moi' },
    skip: editionId === undefined,
    fetchPolicy: 'cache-and-network',
  })
  const { data: lieux } = useQuery(LIEUX, {
    variables: { activiteId: activite.id },
  })
  const agendas = useAgendasEcrits(editionId)
  const [saisie, setSaisie] = useState<
    SequenceSaisie | NouvelleSequence | null
  >(null)
  const [lieuxOuverts, setLieuxOuverts] = useState(false)
  const sequences = useMemo(() => data?.programme ?? [], [data])
  const jours = useMemo(() => joursDuProgramme(sequences), [sequences])
  const aujourdhui = jourLocal()
  // Le jour de l'adresse ne vaut que s'il porte encore une séquence.
  const jourDemande = parametres.get('jour')
  const jourChoisi =
    (jourDemande !== null && jours.includes(jourDemande)
      ? jourDemande
      : undefined) ??
    jours.find(j => j >= aujourdhui) ??
    jours[jours.length - 1] ??
    null
  const ouverte = sequences.find(s => s.id === parametres.get('sequence'))
  // Les lieux actifs dans leur ordre, puis les lieux archivés que des séquences
  // gardent : le programme d'une période passée garde ses colonnes.
  const actifs = lieux?.lieux ?? []
  const nomLieu = new Map<string, string>([
    ...sequences.flatMap(s =>
      s.lieu ? [[s.lieu.id, s.lieu.nom] as [string, string]] : []
    ),
    ...actifs.map(l => [l.id, l.nom] as [string, string]),
  ])
  const archives = [
    ...new Set(
      sequences.flatMap(s =>
        s.lieu && !actifs.some(l => l.id === s.lieu!.id) ? [s.lieu.id] : []
      )
    ),
  ].sort((a, b) => nomLieu.get(a)!.localeCompare(nomLieu.get(b)!, 'fr'))
  const ordreLieux = [...actifs.map(l => l.id), ...archives]

  const changer = (cle: string, valeur: string | null) => {
    const suite = new URLSearchParams(parametres)
    if (valeur === null) suite.delete(cle)
    else suite.set(cle, valeur)
    setParametres(suite)
  }

  if (editionId === undefined && courante && !courante.editionCourante) {
    return (
      <Result status="info" title={`${periode.Aucune} n’est en préparation.`} />
    )
  }
  if (error && !data) {
    return (
      <Result
        status="warning"
        title="Le programme n’a pas pu être chargé."
        subTitle="Rechargez la page dans un instant."
      />
    )
  }

  const carte = (s: SequenceLue, avecHeure = true) => (
    <button
      type="button"
      className="rt-sequence"
      style={{
        borderInlineStartColor: s.perimetre?.couleur ?? 'var(--rt-primaire)',
      }}
      onClick={() => changer('sequence', s.id)}
    >
      <span className="rt-sequence-titre">{s.titre}</span>
      {avecHeure && (
        <span className="rt-sequence-heure">
          {s.heureDebut} → {s.heureFin}
        </span>
      )}
      {s.perimetre && (
        <span className="rt-sequence-perimetre">{s.perimetre.nom}</span>
      )}
      {s.places.length > 0 && (
        <span className="rt-sequence-personnes">{personnes(s)}</span>
      )}
    </button>
  )

  // Une séquence de nuit paraît aussi le jour où elle finit.
  const duJour =
    jourChoisi === null
      ? []
      : sequences.filter(s => segmentDuJour(s, jourChoisi) !== null)
  const grille =
    jourChoisi === null
      ? null
      : grilleDuJour(
          duJour.map(s => ({ ...s, lieuId: s.lieu?.id ?? null })),
          ordreLieux,
          jourChoisi
        )

  const vueGrille = grille && grille.placements.length > 0 && (
    <div className="rt-grille-defilement">
      <div
        className="rt-grille"
        role="table"
        aria-label={`Programme du ${libelleJours(jourChoisi!)}`}
        style={{
          gridTemplateColumns: `56px repeat(${grille.colonnes.reduce((n, c) => n + c.couloirs, 0)}, minmax(150px, 1fr))`,
          gridTemplateRows: `auto repeat(${grille.tranches}, 30px)`,
        }}
      >
        {grille.colonnes.map(c => (
          <div
            key={c.lieuId ?? 'sans-lieu'}
            className="rt-grille-lieu"
            role="columnheader"
            style={{
              gridColumn: `${c.premiere + 1} / span ${c.couloirs}`,
              gridRow: 1,
            }}
          >
            {c.lieuId === null ? 'Sans lieu' : nomLieu.get(c.lieuId)}
          </div>
        ))}
        {Array.from({ length: grille.tranches / 2 }, (_, i) => (
          <div
            key={i}
            className="rt-grille-heure"
            style={{ gridColumn: 1, gridRow: `${i * 2 + 2} / span 2` }}
          >
            {heureCourte(grille.debut + i * 2 * TRANCHE_MINUTES)}
          </div>
        ))}
        {grille.placements.map(p => (
          <div
            key={p.sequence.id}
            className="rt-grille-case"
            style={{
              gridColumn: p.colonne + 1,
              gridRow: `${p.ligneDebut + 1} / ${p.ligneFin + 1}`,
            }}
          >
            {carte(p.sequence)}
          </div>
        ))}
      </div>
    </div>
  )

  // En liste : un groupe par lieu, dans l'ordre des lieux, puis « Sans lieu ».
  const groupesLieux = [
    ...ordreLieux.map(id => ({
      cle: id,
      titre: nomLieu.get(id) ?? '',
      sequences: duJour.filter(s => s.lieu?.id === id),
    })),
    {
      cle: 'sans-lieu',
      titre: 'Sans lieu',
      sequences: duJour.filter(s => !s.lieu || !ordreLieux.includes(s.lieu.id)),
    },
  ].filter(g => g.sequences.length > 0)

  const vueListe = groupesLieux.map(g => (
    <Section
      key={g.cle}
      titre={g.titre}
      compte={`${g.sequences.length} ${g.sequences.length > 1 ? 'séquences' : 'séquence'}`}
    >
      <div className="rt-sequences">{g.sequences.map(s => carte(s))}</div>
    </Section>
  ))

  const vueMoi =
    sequences.length === 0 ? (
      <div className="rt-verre rt-panneau">
        <Empty description="Vous n’êtes placé·e dans aucune séquence du programme." />
      </div>
    ) : (
      jours.map(jour => (
        <Section key={jour} titre={libelleJours(jour)}>
          <div className="rt-sequences">
            {sequences
              .filter(s => s.jour === jour)
              .map(s => (
                <div key={s.id} className="rt-sequence-ligne">
                  <span className="rt-agenda-jour">
                    {s.heureDebut} → {s.heureFin}
                  </span>
                  {carte(s, false)}
                  <span className="rt-note">
                    {s.lieu ? (
                      <>
                        <EnvironmentOutlined aria-hidden /> {s.lieu.nom}
                      </>
                    ) : null}
                    {s.places.find(p => p.estMoi)?.role === 'RESPONSABLE'
                      ? ' · vous êtes responsable'
                      : ' · en renfort'}
                  </span>
                </div>
              ))}
          </div>
        </Section>
      ))
    )

  return (
    <>
      <Titre
        sousTitre={`Le déroulé du jour J ${periode.de}, par lieu et par heure.`}
        actions={
          <>
            {agendas.length > 0 && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  setSaisie({
                    perimetreId: agendas[0]?.perimetreId ?? null,
                    jour: jourChoisi ?? undefined,
                  })
                }
              >
                Nouvelle séquence
              </Button>
            )}
            <ChoixEdition
              valeur={editionId}
              onChange={id => setParametres({ edition: id })}
            />
          </>
        }
      >
        Programme
      </Titre>

      <div
        className="rt-puces rt-sans-impression"
        style={{ marginBottom: 22, rowGap: 10 }}
      >
        <Puces<Vue>
          libelle="Affichage du programme"
          valeur={vue}
          onChange={v => changer('vue', v)}
          options={[
            ...(ecrans.md
              ? [{ valeur: 'grille' as const, libelle: 'Grille' }]
              : []),
            { valeur: 'liste', libelle: 'Par lieu' },
            { valeur: 'moi', libelle: 'Mon jour J' },
          ]}
        />
        {vue !== 'moi' && jours.length > 1 && (
          <>
            <SeparateurPuces />
            <Puces<string>
              libelle="Jour du programme"
              valeur={jourChoisi ?? ''}
              onChange={j => changer('jour', j)}
              options={jours.map(j => ({
                valeur: j,
                libelle: libelleJours(j),
              }))}
            />
          </>
        )}
        <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
          {gere && (
            <Button
              icon={<EnvironmentOutlined />}
              onClick={() => setLieuxOuverts(true)}
            >
              Lieux
            </Button>
          )}
          {vue !== 'moi' && (
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Imprimer
            </Button>
          )}
        </span>
      </div>

      {!data ? (
        <Skeleton active />
      ) : vue === 'moi' ? (
        vueMoi
      ) : sequences.length === 0 ? (
        <div className="rt-verre rt-panneau">
          <Empty
            description={`Le programme ${periode.de} n’a encore aucune séquence.`}
          />
        </div>
      ) : (
        <>
          {jourChoisi && (
            <h2 className="rt-programme-jour">{libelleJours(jourChoisi)}</h2>
          )}
          {vue === 'grille' ? vueGrille : vueListe}
        </>
      )}

      <SequenceDetail
        sequence={ouverte ?? null}
        // Un admin de l'activité lit les fiches, même sur une période archivée.
        lisible={gere || agendas.length > 0}
        onModifier={s => {
          changer('sequence', null)
          setSaisie(s)
        }}
        onFermer={() => changer('sequence', null)}
      />
      {editionId && (
        <SequenceFormulaire
          editionId={editionId}
          agendas={agendas}
          sequence={saisie}
          onFermer={() => setSaisie(null)}
        />
      )}
      {gere && (
        <LieuxFenetre
          activiteId={activite.id}
          ouvert={lieuxOuverts}
          onFermer={() => setLieuxOuverts(false)}
        />
      )}
    </>
  )
}
