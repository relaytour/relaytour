import { SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Drawer, Empty, Input, Result, Skeleton, Space } from 'antd'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import ChoixEdition from '../composants/ChoixEdition'
import EtiquettePerimetre from '../composants/EtiquettePerimetre'
import { PastilleEtat } from '../composants/Etat'
import LigneTache from '../composants/LigneTache'
import { DeuxColonnes, Panneau } from '../composants/Panneau'
import { Avatar } from '../composants/Personne'
import { Puces, SeparateurPuces } from '../composants/Puces'
import Titre from '../composants/Titre'
import VersPremiersPas from '../composants/VersPremiersPas'
import { graphql } from '../gql'
import type { ChargeEquipeQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import {
  filtrerCharges,
  lireReglagesCharge,
  part,
  poids,
  type ReglagesCharge,
  type Temps,
  type TriCharge,
} from '../lib/charge'
import { dateCourte } from '../lib/erreurs'
import { EDITION_COURANTE } from '../lib/requetes'

// Charge de l'équipe (ADR 0055) : pour une édition, les tâches assignées, les
// places au programme et les affectations de chaque personne. Aucun seuil : la
// page compare les personnes entre elles, sur une échelle commune.

const CHARGE = graphql(`
  query ChargeEquipe($editionId: ID!) {
    moi {
      id
    }
    chargeEquipe(editionId: $editionId) {
      personne {
        id
        nom
      }
      affectations {
        contactPrincipal
        perimetre {
          id
          nom
          groupe
          couleur
        }
      }
      maintenant {
        total
        enRetard
        proches
        plusTard
        sansEcheance
        partagees
      }
      edition {
        total
        aFaire
        enCours
        faites
        abandonnees
        parPhase {
          cle
          total
        }
      }
      places {
        total
        aVenir
        prochaine
      }
      realisees
    }
  }
`)

const TACHES_DE = graphql(`
  query TachesDe($personneId: ID!, $editionId: ID!, $temps: TempsCharge!) {
    tachesDe(personneId: $personneId, editionId: $editionId, temps: $temps) {
      id
      titre
      echeance
      statut
      enRetard
      perimetre {
        id
        slug
        nom
        couleur
      }
      assignes {
        id
        nom
      }
    }
    chargeCumulee(personneId: $personneId) {
      activite {
        id
        slug
        nom
      }
      edition {
        id
        nom
      }
      ouvertes
      enRetard
      placesAVenir
      perimetres
    }
  }
`)

type Ligne = ChargeEquipeQuery['chargeEquipe'][number]

// Les couleurs des parts d'une barre, des plus urgentes aux moins urgentes.
const COULEURS = {
  enRetard: 'var(--rt-erreur)',
  proches: 'var(--rt-alerte)',
  plusTard: 'var(--rt-primaire)',
  sansEcheance: 'var(--rt-encre-40)',
  faites: 'var(--rt-succes)',
  enCours: 'var(--rt-primaire)',
  aFaire: 'var(--rt-encre-40)',
  abandonnees: 'var(--rt-encre-14)',
} as const

function Barre({
  ligne,
  temps,
  echelle,
}: {
  ligne: Ligne
  temps: Temps
  echelle: number
}) {
  const { t } = useLingui()
  const m = ligne.maintenant
  const e = ligne.edition
  const parts =
    temps === 'maintenant'
      ? [
          { valeur: m.enRetard, couleur: COULEURS.enRetard },
          { valeur: m.proches, couleur: COULEURS.proches },
          { valeur: m.plusTard, couleur: COULEURS.plusTard },
          { valeur: m.sansEcheance, couleur: COULEURS.sansEcheance },
        ]
      : [
          { valeur: e.faites, couleur: COULEURS.faites },
          { valeur: e.enCours, couleur: COULEURS.enCours },
          { valeur: e.aFaire, couleur: COULEURS.aFaire },
          { valeur: e.abandonnees, couleur: COULEURS.abandonnees },
        ]
  const total = poids(ligne, temps)
  return (
    <div
      className="rt-barre-empilee rt-charge-barre"
      role="img"
      aria-label={t`${plural(total, { one: '# tâche', other: '# tâches' })}`}
    >
      {parts
        .filter(p => p.valeur > 0)
        .map((p, i) => (
          <span
            key={i}
            style={{ width: part(p.valeur, echelle), background: p.couleur }}
          />
        ))}
    </div>
  )
}

function Resume({ ligne, temps }: { ligne: Ligne; temps: Temps }) {
  const { t } = useLingui()
  const m = ligne.maintenant
  const e = ligne.edition
  const ouvertes = m.total
  const enRetard = m.enRetard
  const partagees = m.partagees
  const assignees = e.total
  const faites = e.faites
  const aVenir = ligne.places.aVenir
  const places = ligne.places.total
  const elements =
    temps === 'maintenant'
      ? [
          t`${plural(ouvertes, { one: '# tâche ouverte', other: '# tâches ouvertes' })}`,
          ...(partagees > 0
            ? [
                t`${plural(partagees, { one: '# partagée', other: '# partagées' })}`,
              ]
            : []),
          ...(aVenir > 0
            ? [
                t`${plural(aVenir, { one: '# place à venir', other: '# places à venir' })}`,
              ]
            : []),
        ]
      : [
          t`${plural(assignees, { one: '# tâche assignée', other: '# tâches assignées' })}`,
          t`${plural(faites, { one: '# faite', other: '# faites' })}`,
          ...(places > 0
            ? [
                t`${plural(places, { one: '# place au programme', other: '# places au programme' })}`,
              ]
            : []),
        ]
  return (
    <span className="rt-charge-resume">
      <span>{elements.join(' · ')}</span>
      {temps === 'maintenant' && enRetard > 0 && (
        <PastilleEtat variante="retard">
          <Trans>{enRetard} en retard</Trans>
        </PastilleEtat>
      )}
    </span>
  )
}

function Legende({ temps }: { temps: Temps }) {
  const { t } = useLingui()
  const entrees =
    temps === 'maintenant'
      ? [
          { couleur: COULEURS.enRetard, nom: t`En retard` },
          { couleur: COULEURS.proches, nom: t`Échéance sous 7 jours` },
          { couleur: COULEURS.plusTard, nom: t`Échéance plus lointaine` },
          { couleur: COULEURS.sansEcheance, nom: t`Sans échéance` },
        ]
      : [
          {
            couleur: COULEURS.faites,
            nom: t({
              message: 'Faites',
              comment: 'Nombre de tâches faites, au pluriel',
            }),
          },
          {
            couleur: COULEURS.enCours,
            nom: t({ message: 'En cours', comment: 'Statut d’une tâche' }),
          },
          {
            couleur: COULEURS.aFaire,
            nom: t({ message: 'À faire', comment: 'Statut d’une tâche' }),
          },
          {
            couleur: COULEURS.abandonnees,
            nom: t({
              message: 'Abandonnées',
              comment: 'Nombre de tâches abandonnées, au pluriel',
            }),
          },
        ]
  return (
    <ul className="rt-legende">
      {entrees.map(e => (
        <li key={e.nom}>
          <span className="rt-point" style={{ background: e.couleur }} />
          {e.nom}
        </li>
      ))}
    </ul>
  )
}

/** Le détail d'une personne : ses tâches, ses phases et sa charge ailleurs. */
function Detail({
  ligne,
  temps,
  editionId,
  moiId,
}: {
  ligne: Ligne
  temps: Temps
  editionId: string
  moiId: string
}) {
  const { t } = useLingui()
  const { activite } = useActivite()
  const { data, loading } = useQuery(TACHES_DE, {
    variables: {
      personneId: ligne.personne.id,
      editionId,
      temps: temps === 'maintenant' ? 'MAINTENANT' : 'EDITION',
    },
    fetchPolicy: 'cache-and-network',
  })
  const libellePhase = (cle: string | null) =>
    cle === null
      ? t`Sans échéance`
      : (activite.phases.find(p => p.cle === cle)?.libelle ?? cle)
  const phases = ligne.edition.parPhase.filter(p => p.total > 0)
  const ailleurs = (data?.chargeCumulee ?? []).filter(
    c => c.activite.id !== activite.id
  )
  const realisees = ligne.realisees
  const prochaine = ligne.places.prochaine
  const dateProchaine = prochaine ? dateCourte(prochaine) : ''

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      <Resume ligne={ligne} temps={temps} />
      {realisees !== null && realisees !== undefined && (
        <p className="rt-texte-secondaire" style={{ margin: 0 }}>
          {t`${plural(realisees, {
            one: '# tâche réalisée sur cette période.',
            other: '# tâches réalisées sur cette période.',
          })}`}
        </p>
      )}
      {prochaine && (
        <p className="rt-texte-secondaire" style={{ margin: 0 }}>
          <Trans>Prochaine place au programme : {dateProchaine}.</Trans>
        </p>
      )}
      {temps === 'edition' && phases.length > 0 && (
        <section>
          <h3 className="rt-charge-sous-titre">
            <Trans>Par phase</Trans>
          </h3>
          <ul className="rt-charge-phases">
            {phases.map(p => (
              <li key={p.cle ?? 'sans'}>
                <span>{libellePhase(p.cle)}</span>
                <span className="rt-compte">{p.total}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className="rt-charge-sous-titre">
          {temps === 'maintenant' ? (
            <Trans>Tâches ouvertes</Trans>
          ) : (
            <Trans>Tâches assignées</Trans>
          )}
        </h3>
        {loading && !data ? (
          <Skeleton active />
        ) : (data?.tachesDe.length ?? 0) === 0 ? (
          <Empty description={t`Aucune tâche.`} />
        ) : (
          <ul className="rt-liste-liens" style={{ gap: 8 }}>
            {data!.tachesDe.map(tache => (
              <LigneTache
                key={tache.id}
                tache={tache}
                moiId={moiId}
                editionId={editionId}
              />
            ))}
          </ul>
        )}
      </section>
      {ailleurs.length > 0 && (
        <section>
          <h3 className="rt-charge-sous-titre">
            <Trans>Dans les autres activités</Trans>
          </h3>
          <ul className="rt-charge-phases">
            {ailleurs.map(c => {
              const ouvertes = c.ouvertes
              const enRetard = c.enRetard
              return (
                <li key={c.activite.id}>
                  <Link to={`/${c.activite.slug}/charge`}>
                    {c.activite.nom} · {c.edition.nom}
                  </Link>
                  <span className="rt-compte">
                    {t`${plural(ouvertes, { one: '# tâche ouverte', other: '# tâches ouvertes' })}`}
                    {enRetard > 0 && <> · {t`${enRetard} en retard`}</>}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </Space>
  )
}

export default function Charge() {
  const { t } = useLingui()
  const { activite, periode } = useActivite()
  const [parametres, setParametres] = useSearchParams()
  const reglages = lireReglagesCharge(parametres)
  const { data: courante } = useQuery(EDITION_COURANTE)
  const editionId = parametres.get('edition') ?? courante?.editionCourante?.id
  const { data, error } = useQuery(CHARGE, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
    fetchPolicy: 'cache-and-network',
  })
  const [ouverte, setOuverte] = useState<string | null>(null)

  const regler = (changes: Partial<ReglagesCharge & { edition: string }>) => {
    const suivants = new URLSearchParams(parametres)
    for (const [cle, valeur] of Object.entries(changes)) {
      if (valeur === undefined || valeur === '') suivants.delete(cle)
      else suivants.set(cle, valeur)
    }
    setParametres(suivants, { replace: true })
  }

  // Le filtre est peu coûteux : il se recalcule à chaque rendu.
  const lignes = filtrerCharges(data?.chargeEquipe ?? [], reglages)
  // Une échelle commune : la barre la plus longue occupe toute la largeur.
  const echelle = Math.max(1, ...lignes.map(l => poids(l, reglages.temps)))
  const detail = data?.chargeEquipe.find(l => l.personne.id === ouverte)
  const moiId = data?.moi?.id ?? ''

  const aucunePeriode = periode.Aucune
  const dePeriode = periode.de
  const laPeriode = periode.la
  if (editionId === undefined && courante && !courante.editionCourante) {
    return (
      <Result
        status="info"
        title={t`${aucunePeriode} n’est en préparation.`}
        extra={<VersPremiersPas />}
      />
    )
  }
  if (error && !data) {
    return (
      <Result
        status="warning"
        title={t`La charge de l’équipe n’a pas pu être chargée.`}
        subTitle={t`Rechargez la page dans un instant.`}
      />
    )
  }

  const totalOuvertes = lignes.reduce((n, l) => n + l.maintenant.total, 0)
  const totalRetard = lignes.reduce((n, l) => n + l.maintenant.enRetard, 0)
  const totalPlaces = lignes.reduce((n, l) => n + l.places.aVenir, 0)
  const nbPersonnes = lignes.length

  return (
    <>
      <Titre
        sousTitre={
          reglages.temps === 'maintenant'
            ? t`Les tâches ouvertes et les places à venir de chaque personne ${dePeriode}.`
            : t`Toutes les tâches assignées et les places de chaque personne sur ${laPeriode}.`
        }
        actions={
          <ChoixEdition
            valeur={editionId}
            onChange={id => regler({ edition: id })}
          />
        }
      >
        <Trans>Charge de l’équipe</Trans>
      </Titre>

      <div className="rt-puces" style={{ marginBottom: 22, rowGap: 10 }}>
        <Puces<Temps>
          libelle={t`Période de lecture`}
          valeur={reglages.temps}
          onChange={temps => regler({ temps })}
          options={[
            { valeur: 'maintenant', libelle: t`Maintenant` },
            { valeur: 'edition', libelle: t`Toute la période` },
          ]}
        />
        <SeparateurPuces />
        <Puces<string>
          libelle={t`Groupe de périmètres`}
          valeur={reglages.groupe}
          onChange={groupe => regler({ groupe })}
          options={[
            {
              valeur: 'tous',
              libelle: t({
                message: 'Tous',
                comment: 'Tous les groupes de périmètres',
              }),
            },
            ...activite.groupes.map(g => ({
              valeur: g.cle,
              libelle: g.libellePluriel,
            })),
          ]}
        />
        <SeparateurPuces />
        <Puces<TriCharge>
          libelle={t`Tri des personnes`}
          valeur={reglages.tri}
          onChange={tri => regler({ tri })}
          options={[
            { valeur: 'charge', libelle: t`Par charge` },
            { valeur: 'nom', libelle: t`Par nom` },
          ]}
        />
        <Input
          allowClear
          prefix={<SearchOutlined aria-hidden />}
          aria-label={t`Rechercher une personne ou un périmètre`}
          placeholder={t`Rechercher une personne ou un périmètre`}
          value={reglages.q}
          onChange={e => regler({ q: e.target.value })}
          style={{
            flex: '1 1 240px',
            minWidth: 0,
            maxWidth: 320,
            marginInlineStart: 'auto',
          }}
        />
      </div>

      {!data ? (
        <Skeleton active />
      ) : (
        <DeuxColonnes
          cote={
            <Panneau
              titre={t`Sur cette sélection`}
              extra={
                <span className="rt-compte">
                  {t`${plural(nbPersonnes, { one: '# personne', other: '# personnes' })}`}
                </span>
              }
            >
              <ul className="rt-charge-phases">
                <li>
                  <span>
                    <Trans>Tâches ouvertes assignées</Trans>
                  </span>
                  <span className="rt-compte">{totalOuvertes}</span>
                </li>
                <li>
                  <span>
                    <Trans>Dont en retard</Trans>
                  </span>
                  <span className="rt-compte">{totalRetard}</span>
                </li>
                <li>
                  <span>
                    <Trans>Places à venir au programme</Trans>
                  </span>
                  <span className="rt-compte">{totalPlaces}</span>
                </li>
              </ul>
              <Legende temps={reglages.temps} />
              <p className="rt-texte-secondaire" style={{ margin: 0 }}>
                <Trans>
                  Une tâche assignée à plusieurs personnes compte pour chacune
                  d’elles.
                </Trans>
              </p>
            </Panneau>
          }
        >
          {lignes.length === 0 ? (
            <div className="rt-verre rt-panneau">
              <Empty
                description={t`Aucune personne ne correspond à ces filtres.`}
              />
            </div>
          ) : (
            <ul className="rt-liste-liens rt-charge-liste">
              {lignes.map(ligne => {
                const nom = ligne.personne.nom
                return (
                  <li key={ligne.personne.id}>
                    <button
                      type="button"
                      className="rt-verre rt-charge-ligne"
                      onClick={() => setOuverte(ligne.personne.id)}
                    >
                      <span className="rt-charge-personne">
                        <Avatar nom={ligne.personne.nom} />
                        <span className="rt-charge-nom">
                          {ligne.personne.id === moiId ? t`${nom} (vous)` : nom}
                        </span>
                      </span>
                      <span className="rt-charge-perimetres">
                        {ligne.affectations.map(a => (
                          <EtiquettePerimetre
                            key={a.perimetre.id}
                            nom={a.perimetre.nom}
                            couleur={a.perimetre.couleur}
                          />
                        ))}
                      </span>
                      <span className="rt-charge-mesure">
                        <Barre
                          ligne={ligne}
                          temps={reglages.temps}
                          echelle={echelle}
                        />
                        <Resume ligne={ligne} temps={reglages.temps} />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </DeuxColonnes>
      )}

      <Drawer
        open={detail !== undefined}
        onClose={() => setOuverte(null)}
        title={detail?.personne.nom}
        size={560}
      >
        {detail && editionId && (
          <Detail
            ligne={detail}
            temps={reglages.temps}
            editionId={editionId}
            moiId={moiId}
          />
        )}
      </Drawer>
    </>
  )
}
