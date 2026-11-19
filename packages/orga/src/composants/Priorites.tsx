import { FlagOutlined, PushpinFilled } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'

import { graphql } from '../gql'
import type {
  PrioritesQuery,
  TachesACommencerQuery,
} from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { jourLocal } from '../lib/agenda'
import { debutDeLaPeriode } from '../lib/durees'
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
            jours
            nombre
            titre
            niveau
          }
          tache {
            id
            titre
            echeance
            duree
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
      jalons {
        id
        titre
        echeance
        duree
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
        resumeJalon {
          total
          ouvertes
          abandonnees
        }
      }
    }
  }
`)

// Les tâches à commencer (ADR 0068) se lisent à part : dans la requête des
// priorités, elles dépasseraient le plafond de complexité du serveur.
const A_COMMENCER = graphql(`
  query TachesACommencer($editionId: ID!) {
    tachesACommencer(editionId: $editionId) {
      perimetres {
        perimetre {
          id
        }
        taches {
          id
          titre
          echeance
          duree
          statut
          enRetard
          assignes {
            id
            nom
          }
        }
        autres
      }
    }
  }
`)

type TacheACommencer = NonNullable<
  TachesACommencerQuery['tachesACommencer']
>['perimetres'][number]['taches'][number]

type PerimetrePriorites = NonNullable<
  PrioritesQuery['priorites']
>['perimetres'][number] & {
  aCommencer: TacheACommencer[]
  aCommencerAutres: number
}
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
      // Jalons (ADR 0062).
      case 'JALON':
        return t`${plural(nombre, { one: 'Jalon : # tâche liée reste ouverte', other: 'Jalon : # tâches liées restent ouvertes' })}`
      case 'MENE_A_UN_JALON': {
        const titre = r.titre ?? ''
        return t`Mène au jalon « ${titre} »`
      }
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
  const [toutACommencer, setToutACommencer] = useState(false)
  const {
    perimetre,
    priorites,
    autres,
    ensuite,
    aCommencer,
    aCommencerAutres,
  } = bloc
  const visibles = tout ? priorites : priorites.slice(0, PRIORITES_VISIBLES)
  const cachees = priorites.length - visibles.length
  const aCommencerVisibles = toutACommencer
    ? aCommencer
    : aCommencer.slice(0, PRIORITES_VISIBLES)
  const aCommencerCachees = aCommencer.length - aCommencerVisibles.length
  const aujourdhui = jourLocal()
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
        // La ligne « Ensuite » cède la place aux tâches à commencer (ADR 0068).
        aCommencer.length === 0 && (
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
        )
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
      {aCommencer.length > 0 && (
        <div className="rt-priorites-a-commencer">
          <h4 className="rt-priorites-sous-titre">
            <Trans>À commencer</Trans>
          </h4>
          <div className="rt-priorites-liste">
            {aCommencerVisibles.map(tache => {
              const debut = debutDeLaPeriode(tache) ?? ''
              const dateDebut = debut ? dateCourte(debut) : ''
              return (
                <div key={tache.id} className="rt-priorite">
                  <ul className="rt-liste-liens">
                    <LigneTache
                      // Le périmètre est celui du bloc : la requête ne le relit
                      // pas, pour rester sous le plafond de complexité.
                      tache={{ ...tache, perimetre }}
                      moiId={moiId}
                      editionId={editionId}
                      sansPerimetre
                    />
                  </ul>
                  <p className="rt-priorite-raisons">
                    {debut <= aujourdhui
                      ? t`Période de travail commencée le ${dateDebut}`
                      : t`Peut commencer dès le ${dateDebut}`}
                  </p>
                </div>
              )
            })}
          </div>
          {(aCommencerCachees > 0 || aCommencerAutres > 0) && (
            <p className="rt-priorites-suite">
              {aCommencerCachees > 0 && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setToutACommencer(true)}
                >
                  {t`${plural(aCommencerCachees, { one: 'Voir l’autre tâche à commencer', other: 'Voir les # autres tâches à commencer' })}`}
                </Button>
              )}
              {aCommencerAutres > 0 && !aPrendre && (
                <Link
                  to={lien(
                    `/perimetres/${perimetre.slug}?edition=${editionId}`
                  )}
                >
                  {t`${plural(aCommencerAutres, { one: '# autre tâche à commencer au-delà des cinq', other: '# autres tâches à commencer au-delà des cinq' })}`}
                </Link>
              )}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

type JalonLu = NonNullable<PrioritesQuery['priorites']>['jalons'][number]

/**
 * Les jalons ouverts de l'horizon, tous périmètres confondus (ADR 0062). Chaque
 * jalon indique combien de ses tâches liées restent ouvertes.
 */
function JalonsDeLHorizon({
  jalons,
  moiId,
  editionId,
}: {
  jalons: readonly JalonLu[]
  moiId: string
  editionId: string
}) {
  const { t } = useLingui()
  return (
    <section className="rt-priorites-perimetre rt-priorites-jalons">
      <h3 className="rt-priorites-titre">
        <FlagOutlined aria-hidden />
        <Trans>Jalons avant le prochain point</Trans>
      </h3>
      <div className="rt-priorites-liste">
        {jalons.map(jalon => {
          const { total, ouvertes, abandonnees } = jalon.resumeJalon
          const gardees = total - abandonnees
          return (
            <div key={jalon.id} className="rt-priorite">
              <ul className="rt-liste-liens">
                <LigneTache tache={jalon} moiId={moiId} editionId={editionId} />
              </ul>
              <p className="rt-priorite-raisons">
                {gardees === 0
                  ? t`Aucune tâche liée`
                  : t`${plural(ouvertes, { one: `# tâche ouverte sur ${gardees}`, other: `# tâches ouvertes sur ${gardees}` })}`}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Le panneau « Priorités » d'une période. */
export default function Priorites({
  editionId,
  moiId,
  mesPerimetres,
  replie,
  onBasculer,
}: {
  editionId: string
  moiId: string
  /** Les périmètres où la personne est affectée pour la période. */
  mesPerimetres: ReadonlySet<string>
  replie: boolean
  onBasculer: () => void
}) {
  const { t } = useLingui()
  const { activite, libelleGroupe } = useActivite()
  const { data, loading } = useQuery(PRIORITES, { variables: { editionId } })
  const { data: donneesACommencer } = useQuery(A_COMMENCER, {
    variables: { editionId },
  })
  const [filtre, setFiltre] = useState<FiltrePriorites>(() =>
    lireFiltre(activite.slug)
  )
  const changer = (modification: Partial<FiltrePriorites>) => {
    const suivant = { ...filtre, ...modification }
    setFiltre(suivant)
    ecrireFiltre(activite.slug, suivant)
  }
  const lues = data?.priorites
  const aCommencerPar = new Map(
    (donneesACommencer?.tachesACommencer?.perimetres ?? []).map(p => [
      p.perimetre.id,
      p,
    ])
  )
  const tous: PerimetrePriorites[] = (lues?.perimetres ?? []).map(p => ({
    ...p,
    aCommencer: aCommencerPar.get(p.perimetre.id)?.taches ?? [],
    aCommencerAutres: aCommencerPar.get(p.perimetre.id)?.autres ?? 0,
  }))
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
  // Les tâches à commencer comptent pour dire qu'un filtre vide la liste (ADR 0068).
  const nombreAffiche = affiches.reduce(
    (s, p) => s + p.priorites.length + p.aCommencer.length,
    0
  )
  const ailleurs = tous.some(
    p => p.priorites.length > 0 || p.aCommencer.length > 0
  )
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
      repliable={{ replie, onBasculer, nom: t`Priorités` }}
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
                  Prochain point d’équipe : {jourPoint} à {heurePoint}.
                </Trans>{' '}
                {point.lienVisio && (
                  <a href={point.lienVisio} target="_blank" rel="noreferrer">
                    <Trans>Rejoindre la visio</Trans>
                  </a>
                )}
              </>
            ) : (
              <Trans>
                Aucun point d’équipe n’est prévu : les priorités couvrent les 14
                prochains jours.
              </Trans>
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
          {filtreActif && nombreAffiche === 0 && ailleurs ? (
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
              {lues.jalons.length > 0 && (
                <JalonsDeLHorizon
                  jalons={lues.jalons}
                  moiId={moiId}
                  editionId={editionId}
                />
              )}
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
