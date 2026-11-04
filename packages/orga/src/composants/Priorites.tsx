import { PushpinFilled } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'

import { graphql } from '../gql'
import type { PrioritesQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { dateCourte, jourDeLInstant } from '../lib/erreurs'
import { heureCourte, minutes } from '../lib/programme'
import {
  ecrireFiltre,
  filtrerPriorites,
  jourAvecNom,
  lireFiltre,
  PRIORITES_VISIBLES,
  useLibelleAjustement,
  type FiltrePriorites,
} from '../lib/priorites'

import LigneTache from './LigneTache'
import { Panneau } from './Panneau'
import { PastilleEtat } from './Etat'
import { PuceBascule, Puces } from './Puces'

// Priorités d'une période (ADR 0059) : le premier panneau de « Mon espace ». Le
// score vient du serveur et vaut pour toute l'équipe ; le filtre ne change que
// l'affichage.

const PRIORITES = graphql(`
  query Priorites($editionId: ID!) {
    priorites(editionId: $editionId) {
      fin
      prochainPoint {
        id
        titre
        jour
        heureDebut
        lienVisio
      }
      perimetres {
        perimetre {
          id
          slug
          nom
          couleur
          groupe
        }
        priorites {
          score
          raisons {
            code
            points
            jours
            nombre
            niveau
          }
          tache {
            id
            titre
            echeance
            statut
            enRetard
            perimetre {
              slug
              nom
              couleur
            }
            assignes {
              id
              nom
            }
            ajustement {
              par {
                nom
              }
              le
            }
          }
        }
        autres
        ensuite {
          id
          titre
          echeance
        }
      }
    }
  }
`)

type PerimetrePriorites = NonNullable<
  PrioritesQuery['priorites']
>['perimetres'][number]
type RaisonLue = PerimetrePriorites['priorites'][number]['raisons'][number]

function useTexteRaison() {
  const { t } = useLingui()
  const libelleAjustement = useLibelleAjustement()
  return (r: RaisonLue) => {
    const jours = r.jours ?? 0
    const nombre = r.nombre ?? 0
    switch (r.code) {
      case 'RETARD':
        return t`${plural(jours, { one: 'En retard de # jour', other: 'En retard de # jours' })}`
      case 'RETARD_A_REVOIR':
        return t`${plural(jours, { one: 'Échéance dépassée depuis # jour, à revoir', other: 'Échéance dépassée depuis # jours, à revoir' })}`
      case 'ECHEANCE_PROCHE':
        return jours === 0
          ? t`Échéance aujourd’hui`
          : t`${plural(jours, { one: 'Échéance dans # jour', other: 'Échéance dans # jours' })}`
      case 'AVANT_LE_POINT':
        return t`Avant le prochain point`
      case 'REUNION_A_VENIR':
        return t`Liée à une réunion à venir`
      case 'DECLINAISONS':
        return t`${plural(nombre, { one: 'Reprise dans # autre périmètre', other: 'Reprise dans # autres périmètres' })}`
      case 'ACCORD_ATTENDU':
        return t`Accord attendu d’un autre périmètre`
      case 'A_PRENDRE':
        return t`Personne n’est assignée`
      case 'EN_COURS':
        return t`Déjà en cours`
      case 'AJUSTEMENT':
        return r.niveau ? libelleAjustement(r.niveau) : ''
    }
  }
}

function BlocPerimetre({
  bloc,
  mien,
  aPrendre,
  moiId,
  editionId,
}: {
  bloc: PerimetrePriorites
  mien: boolean
  /** Vrai quand le filtre « À prendre » est actif. */
  aPrendre: boolean
  moiId: string
  editionId: string
}) {
  const { t } = useLingui()
  const { lien } = useActivite()
  const texteRaison = useTexteRaison()
  const [tout, setTout] = useState(false)
  const { perimetre, priorites, autres, ensuite } = bloc
  const visibles = tout ? priorites : priorites.slice(0, PRIORITES_VISIBLES)
  const cachees = priorites.length - visibles.length
  const nomPerimetre = perimetre.nom
  const titreEnsuite = ensuite?.titre ?? ''
  const dateEnsuite = ensuite?.echeance ? dateCourte(ensuite.echeance) : ''
  return (
    <section className="rt-priorites-perimetre">
      <h3 className="rt-priorites-titre">
        <span
          className="rt-point"
          style={{ background: perimetre.couleur ?? 'var(--rt-primaire)' }}
          aria-hidden="true"
        />
        <Link to={lien(`/perimetres/${perimetre.slug}?edition=${editionId}`)}>
          {nomPerimetre}
        </Link>
        {mien && (
          <PastilleEtat variante="en-cours" sansPoint>
            {t({ message: 'Vous', comment: 'Périmètre de la personne' })}
          </PastilleEtat>
        )}
      </h3>
      {priorites.length === 0 ? (
        <p className="rt-texte-secondaire rt-priorites-ensuite">
          {ensuite ? (
            dateEnsuite ? (
              <Trans>
                Ensuite : {titreEnsuite}, le {dateEnsuite}.
              </Trans>
            ) : (
              <Trans>Ensuite : {titreEnsuite}.</Trans>
            )
          ) : (
            <Trans>Aucune tâche ouverte avec une échéance.</Trans>
          )}
        </p>
      ) : (
        <div className="rt-priorites-liste">
          {visibles.map(p => {
            const epinglee = p.raisons.some(r => r.niveau === 'EPINGLEE')
            // L'ajustement nomme son auteur et sa date (ADR 0059).
            const ajustement = p.tache.ajustement
            const auteur = ajustement?.par?.nom
            const jour = ajustement ? jourDeLInstant(ajustement.le) : ''
            const raisons = p.raisons
              .map(r => {
                const texte = texteRaison(r)
                if (r.code !== 'AJUSTEMENT' || !ajustement) return texte
                return auteur
                  ? t`${texte} par ${auteur} le ${jour}`
                  : t`${texte} le ${jour}`
              })
              .filter(Boolean)
              .join(' · ')
            return (
              <div key={p.tache.id} className="rt-priorite">
                <ul className="rt-liste-liens">
                  <LigneTache
                    tache={p.tache}
                    moiId={moiId}
                    editionId={editionId}
                    sansPerimetre
                  />
                </ul>
                <p className="rt-priorite-raisons">
                  {epinglee && <PushpinFilled aria-hidden />}
                  {raisons}
                </p>
              </div>
            )
          })}
        </div>
      )}
      {(cachees > 0 || autres > 0) && (
        <p className="rt-priorites-suite">
          {cachees > 0 && (
            <Button type="link" size="small" onClick={() => setTout(true)}>
              {t`${plural(cachees, { one: 'Voir l’autre priorité', other: 'Voir les # autres priorités' })}`}
            </Button>
          )}
          {/* Le nombre du serveur compte toutes les tâches : avec le filtre
              « À prendre », il compterait des tâches que le filtre masque. */}
          {autres > 0 && !aPrendre && (
            <Link
              to={lien(`/perimetres/${perimetre.slug}?edition=${editionId}`)}
            >
              {t`${plural(autres, { one: '# autre tâche au-delà des cinq priorités', other: '# autres tâches au-delà des cinq priorités' })}`}
            </Link>
          )}
        </p>
      )}
    </section>
  )
}

/** Le panneau « Priorités » d'une période. */
export default function Priorites({
  editionId,
  moiId,
  mesPerimetres,
}: {
  editionId: string
  moiId: string
  /** Les périmètres où la personne est affectée pour la période. */
  mesPerimetres: ReadonlySet<string>
}) {
  const { t } = useLingui()
  const { activite, libelleGroupe } = useActivite()
  const { data, loading } = useQuery(PRIORITES, { variables: { editionId } })
  const [filtre, setFiltre] = useState<FiltrePriorites>(() =>
    lireFiltre(activite.slug)
  )
  const changer = (modification: Partial<FiltrePriorites>) => {
    const suivant = { ...filtre, ...modification }
    setFiltre(suivant)
    ecrireFiltre(activite.slug, suivant)
  }
  const lues = data?.priorites
  const tous = lues?.perimetres ?? []
  const groupes = [...new Set(tous.map(p => p.perimetre.groupe))]
  // Un groupe enregistré qui n'existe plus ne filtre rien.
  const filtreEffectif: FiltrePriorites = {
    ...filtre,
    groupe:
      filtre.groupe !== null && groupes.includes(filtre.groupe)
        ? filtre.groupe
        : null,
  }
  const affiches = filtrerPriorites(tous, filtreEffectif, mesPerimetres)
  const nombre = affiches.reduce((s, p) => s + p.priorites.length, 0)
  const ailleurs = tous.some(p => p.priorites.length > 0)
  const filtreActif =
    filtreEffectif.mesPerimetres ||
    filtreEffectif.aPrendre ||
    filtreEffectif.groupe !== null

  const fin = lues ? jourAvecNom(lues.fin) : ''
  const point = lues?.prochainPoint
  const jourPoint = point ? jourAvecNom(point.jour) : ''
  const heurePoint = point ? heureCourte(minutes(point.heureDebut)) : ''

  return (
    <Panneau
      titre={t`Priorités`}
      extra={lues && <span className="rt-compte">{t`jusqu’au ${fin}`}</span>}
    >
      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : !lues ? null : (
        <>
          <p className="rt-texte-secondaire" style={{ marginTop: 0 }}>
            {point ? (
              <>
                <Trans>
                  Prochain point : {jourPoint} à {heurePoint}.
                </Trans>{' '}
                {point.lienVisio && (
                  <a href={point.lienVisio} target="_blank" rel="noreferrer">
                    <Trans>Rejoindre la visio</Trans>
                  </a>
                )}
              </>
            ) : (
              <Trans>Aucun point n’est prévu dans l’agenda global.</Trans>
            )}
          </p>
          <div className="rt-priorites-filtres">
            <Puces
              libelle={t`Périmètres affichés`}
              valeur={filtreEffectif.mesPerimetres ? 'miens' : 'tous'}
              onChange={v => changer({ mesPerimetres: v === 'miens' })}
              options={[
                { valeur: 'tous', libelle: t`Tous les périmètres` },
                { valeur: 'miens', libelle: t`Mes périmètres` },
              ]}
            />
            {groupes.length > 1 && (
              <Puces
                libelle={t`Groupe de périmètres`}
                valeur={filtreEffectif.groupe ?? ''}
                onChange={v => changer({ groupe: v === '' ? null : v })}
                options={[
                  { valeur: '', libelle: t`Tous les groupes` },
                  ...groupes.map(g => ({
                    valeur: g,
                    libelle: libelleGroupe(g, true),
                  })),
                ]}
              />
            )}
            <PuceBascule
              actif={filtreEffectif.aPrendre}
              onChange={actif => changer({ aPrendre: actif })}
            >
              <Trans>À prendre</Trans>
            </PuceBascule>
          </div>
          {filtreActif && nombre === 0 && ailleurs ? (
            <p className="rt-texte-secondaire">
              <Trans>Aucune priorité ne correspond à ce filtre.</Trans>{' '}
              <Button
                type="link"
                size="small"
                onClick={() =>
                  changer({
                    mesPerimetres: false,
                    aPrendre: false,
                    groupe: null,
                  })
                }
              >
                <Trans>Voir tous les périmètres</Trans>
              </Button>
            </p>
          ) : (
            <div className="rt-priorites">
              {nombre === 0 && (
                <p className="rt-texte-secondaire">
                  <Trans>Aucune priorité jusqu’au {fin}.</Trans>
                </p>
              )}
              {affiches.map(bloc => (
                <BlocPerimetre
                  key={bloc.perimetre.id}
                  bloc={bloc}
                  mien={mesPerimetres.has(bloc.perimetre.id)}
                  aPrendre={filtreEffectif.aPrendre}
                  moiId={moiId}
                  editionId={editionId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </Panneau>
  )
}
