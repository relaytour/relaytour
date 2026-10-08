import { useQuery } from '@apollo/client/react'
import { Empty, Result, Select, Skeleton } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import ChoixEdition from '../composants/ChoixEdition'
import EtiquettePerimetre from '../composants/EtiquettePerimetre'
import LigneTache from '../composants/LigneTache'
import { DeuxColonnes, Panneau, Section } from '../composants/Panneau'
import PastillePerimetre from '../composants/PastillePerimetre'
import { PuceBascule, Puces, SeparateurPuces } from '../composants/Puces'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import {
  CLE_REGROUPEMENT_RETROPLANNING,
  ecrireRegroupement,
  grouperParPerimetre,
  grouperParPhase,
  libelleBorne,
  lireRegroupement,
} from '../lib/regroupement'
import { EDITION_COURANTE, EDITIONS } from '../lib/requetes'
import { grouperParMois, libelleMois } from '../lib/retroplanning'
import { estOuverte } from '../lib/taches'
import { useActivite } from '../lib/activite'

const RETROPLANNING = graphql(`
  query Retroplanning($editionId: ID!) {
    moi {
      id
      estAdmin
      affectations(editionId: $editionId) {
        id
        perimetre {
          id
        }
      }
    }
    retroplanning(editionId: $editionId) {
      id
      titre
      echeance
      statut
      enRetard
      perimetre {
        id
        slug
        nom
        groupe
        couleur
        ordre
      }
      assignes {
        id
        nom
      }
    }
  }
`)

// Un groupe de périmètres de l'activité (ADR 0008), ou tous.
type FiltreType = string
type FiltreStatut = 'ouvertes' | 'retard' | 'toutes'
// Regroupement de la liste (ADR 0025) : par mois d'échéance, ou par phase de
// l'activité puis par périmètre.
type Regroupement = 'mois' | 'phase'
const REGROUPEMENTS = ['mois', 'phase'] as const

const compteTaches = (n: number) => `${n} ${n > 1 ? 'tâches' : 'tâche'}`

function titreGroupe(mois: string | null): string {
  if (mois === null) return 'Sans échéance'
  const libelle = libelleMois(mois)
  return libelle.charAt(0).toUpperCase() + libelle.slice(1)
}

export default function Retroplanning() {
  const { lien, periode, activite, gere } = useActivite()
  const [parametres, setParametres] = useSearchParams()
  const { data: courante } = useQuery(EDITION_COURANTE)
  const { data: editions } = useQuery(EDITIONS)
  const editionId = parametres.get('edition') ?? courante?.editionCourante?.id
  const { data, error } = useQuery(RETROPLANNING, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
    fetchPolicy: 'cache-and-network',
  })

  const [perimetres, setPerimetres] = useState<string[]>([])
  const [type, setType] = useState<FiltreType>('tous')
  const [statut, setStatut] = useState<FiltreStatut>('ouvertes')
  const [mesPerimetres, setMesPerimetres] = useState(false)
  const [assigneesAMoi, setAssigneesAMoi] = useState(false)
  const [regroupementChoisi, setRegroupement] = useState<Regroupement>(() =>
    lireRegroupement(CLE_REGROUPEMENT_RETROPLANNING, REGROUPEMENTS, 'mois')
  )
  const changerRegroupement = (valeur: Regroupement) => {
    setRegroupement(valeur)
    ecrireRegroupement(CLE_REGROUPEMENT_RETROPLANNING, valeur)
  }

  const moi = data?.moi
  const toutes = data?.retroplanning

  // Les options du filtre : les périmètres présents dans le résultat, rangés par
  // groupe dans l'ordre que déclare l'activité.
  const options = useMemo(() => {
    const presents = [
      ...new Map((toutes ?? []).map(t => [t.perimetre.id, t.perimetre])),
    ]
      .map(([, p]) => p)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    return activite.groupes
      .map(groupe => ({
        label: groupe.libellePluriel,
        options: presents
          .filter(p => p.groupe === groupe.cle)
          .map(p => ({ value: p.id, label: p.nom, couleur: p.couleur })),
      }))
      .filter(groupe => groupe.options.length > 0)
  }, [toutes, activite.groupes])

  const couleurDe = useMemo(
    () =>
      new Map((toutes ?? []).map(t => [t.perimetre.id, t.perimetre.couleur])),
    [toutes]
  )

  const affectes = useMemo(
    () => new Set((moi?.affectations ?? []).map(a => a.perimetre.id)),
    [moi]
  )

  const taches = useMemo(
    () =>
      (toutes ?? []).filter(
        t =>
          (perimetres.length === 0 || perimetres.includes(t.perimetre.id)) &&
          (type === 'tous' || t.perimetre.groupe === type) &&
          (statut === 'toutes' ||
            (statut === 'retard' ? t.enRetard : estOuverte(t))) &&
          (!mesPerimetres || affectes.has(t.perimetre.id)) &&
          (!assigneesAMoi || t.assignes.some(p => p.id === moi?.id))
      ),
    [
      toutes,
      perimetres,
      type,
      statut,
      mesPerimetres,
      affectes,
      assigneesAMoi,
      moi,
    ]
  )
  const groupes = useMemo(() => grouperParMois(taches), [taches])

  // Le premier jour de la période : les bornes des phases se comptent depuis lui.
  // Tant qu'il n'est pas chargé, la liste reste regroupée par mois.
  const debut = editions?.editions.find(e => e.id === editionId)?.debut
  const regroupement: Regroupement =
    regroupementChoisi === 'phase' && debut ? 'phase' : 'mois'
  const phases = useMemo(() => {
    if (!debut) return []
    const cles = activite.groupes.map(g => g.cle)
    return grouperParPhase(taches, activite.phases, debut).map(groupe => ({
      ...groupe,
      perimetres: grouperParPerimetre(groupe.taches, cles),
    }))
  }, [taches, activite.phases, activite.groupes, debut])
  // Un seul périmètre dans la sélection : son nom ne se répète pas sous chaque phase.
  const plusieursPerimetres = useMemo(
    () => new Set(taches.map(t => t.perimetre.id)).size > 1,
    [taches]
  )

  // Les tâches ouvertes sans personne dans les périmètres de l'édition où la
  // personne est affectée : elle peut les prendre depuis leur périmètre.
  const aPrendre = useMemo(
    () =>
      (toutes ?? []).filter(
        t =>
          estOuverte(t) &&
          t.assignes.length === 0 &&
          affectes.has(t.perimetre.id)
      ),
    [toutes, affectes]
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
        title="Le rétroplanning n’a pas pu être chargé."
        subTitle="Rechargez la page dans un instant."
      />
    )
  }

  const lignes = (liste: typeof taches, sansPerimetre = false) => (
    <ul className="rt-liste-liens" style={{ gap: 8 }}>
      {liste.map(tache => (
        <LigneTache
          key={tache.id}
          tache={tache}
          moiId={moi?.id ?? ''}
          editionId={editionId ?? ''}
          sansPerimetre={sansPerimetre}
        />
      ))}
    </ul>
  )

  const enRetard = taches.filter(t => t.enRetard).length
  const repartition = [
    {
      nom: 'À faire',
      nombre: taches.filter(t => t.statut === 'A_FAIRE').length,
      couleur: 'var(--rt-encre-40)',
    },
    {
      nom: 'En cours',
      nombre: taches.filter(t => t.statut === 'EN_COURS').length,
      couleur: 'var(--rt-primaire)',
    },
    {
      nom: 'Faites',
      nombre: taches.filter(t => t.statut === 'FAITE').length,
      couleur: 'var(--rt-succes)',
    },
    {
      nom: 'Abandonnées',
      nombre: taches.filter(t => t.statut === 'ABANDONNEE').length,
      couleur: 'var(--rt-encre-14)',
    },
    { nom: 'En retard', nombre: enRetard, couleur: 'var(--rt-erreur)' },
  ].filter(r => r.nombre > 0 || r.nom === 'En retard')

  return (
    <>
      <Titre
        sousTitre={
          regroupement === 'phase'
            ? `Les tâches ${periode.de} sont rangées par phase, puis par périmètre.`
            : `Les tâches ${periode.de} sont regroupées par mois, de la plus proche à la plus lointaine.`
        }
        actions={
          <ChoixEdition
            valeur={editionId}
            onChange={id => {
              setPerimetres([])
              setParametres({ edition: id })
            }}
          />
        }
      >
        Rétroplanning
      </Titre>

      <div className="rt-puces" style={{ marginBottom: 22, rowGap: 10 }}>
        <Puces<Regroupement>
          libelle="Regroupement des tâches"
          valeur={regroupementChoisi}
          onChange={changerRegroupement}
          options={[
            { valeur: 'mois', libelle: 'Par mois' },
            { valeur: 'phase', libelle: 'Par phase' },
          ]}
        />
        <SeparateurPuces />
        <Puces<FiltreType>
          libelle="Groupe de périmètres"
          valeur={type}
          onChange={setType}
          options={[
            { valeur: 'tous', libelle: 'Tous' },
            ...activite.groupes.map(g => ({
              valeur: g.cle,
              libelle: g.libellePluriel,
            })),
          ]}
        />
        <SeparateurPuces />
        <Puces<FiltreStatut>
          libelle="Statut des tâches"
          valeur={statut}
          onChange={setStatut}
          options={[
            { valeur: 'ouvertes', libelle: 'Ouvertes' },
            { valeur: 'retard', libelle: 'En retard' },
            { valeur: 'toutes', libelle: 'Toutes' },
          ]}
        />
        <SeparateurPuces />
        <PuceBascule actif={mesPerimetres} onChange={setMesPerimetres}>
          Mes périmètres
        </PuceBascule>
        <PuceBascule actif={assigneesAMoi} onChange={setAssigneesAMoi}>
          Assignées à moi
        </PuceBascule>
        <Select
          mode="multiple"
          maxTagCount="responsive"
          allowClear
          aria-label="Périmètres"
          placeholder="Tous les périmètres"
          style={{
            flex: '1 1 240px',
            minWidth: 0,
            maxWidth: 360,
            marginInlineStart: 'auto',
          }}
          value={perimetres}
          onChange={setPerimetres}
          options={options}
          optionFilterProp="label"
          optionRender={option => (
            <PastillePerimetre
              nom={String(option.label)}
              couleur={(option.data as { couleur?: string | null }).couleur}
            />
          )}
          tagRender={({ value, label, closable, onClose }) => (
            <PastillePerimetre
              nom={String(label)}
              couleur={couleurDe.get(String(value))}
              fermer={closable ? onClose : undefined}
            />
          )}
        />
      </div>

      {!data || !moi ? (
        <Skeleton active />
      ) : (
        <DeuxColonnes
          cote={
            <>
              <Panneau
                titre="Sur cette sélection"
                extra={
                  <span className="rt-compte">
                    {taches.length} {taches.length > 1 ? 'tâches' : 'tâche'}
                  </span>
                }
              >
                {repartition.map(r => (
                  <div
                    key={r.nom}
                    style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          fontWeight: 600,
                        }}
                      >
                        <span
                          className="rt-point"
                          style={{ background: r.couleur }}
                        />
                        {r.nom}
                      </span>
                      <span className="rt-compte">{r.nombre}</span>
                    </div>
                    <div className="rt-barre-simple">
                      <span
                        style={{
                          width: `${taches.length === 0 ? 0 : (100 * r.nombre) / taches.length}%`,
                          background: r.couleur,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </Panneau>
              {aPrendre.length > 0 && (
                <Panneau
                  teinte
                  titre={
                    aPrendre.length > 1
                      ? `${aPrendre.length} tâches attendent une personne`
                      : 'Une tâche attend une personne'
                  }
                >
                  <p className="rt-texte-secondaire">
                    Ces tâches ouvertes de vos périmètres n’ont aucune personne
                    assignée. Vous pouvez les prendre depuis leur périmètre.
                  </p>
                  <ul className="rt-liste-liens">
                    {aPrendre.slice(0, 5).map(t => (
                      <li key={t.id}>
                        <Link
                          className="rt-ligne-lien"
                          to={lien(
                            `/perimetres/${t.perimetre.slug}?edition=${editionId}`
                          )}
                          style={{ fontSize: 13.5 }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              minWidth: 0,
                            }}
                          >
                            <span
                              className="rt-point"
                              style={{
                                background:
                                  t.perimetre.couleur ?? 'var(--rt-primaire)',
                              }}
                            />
                            {t.titre}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panneau>
              )}
            </>
          }
        >
          {affectes.size === 0 &&
          (mesPerimetres || (!gere && toutes?.length === 0)) ? (
            <div className="rt-verre rt-panneau">
              <Empty
                description={`Vous n’êtes affecté·e à aucun périmètre pour ${periode.cette}.`}
              />
            </div>
          ) : taches.length === 0 ? (
            <div className="rt-verre rt-panneau">
              <Empty description="Aucune tâche ne correspond à ces filtres." />
            </div>
          ) : (
            <>
              <p style={{ margin: '0 6px', fontWeight: 600 }}>
                {taches.length} {taches.length > 1 ? 'tâches' : 'tâche'}, dont{' '}
                <span
                  style={{
                    color: enRetard > 0 ? 'var(--rt-erreur)' : undefined,
                  }}
                >
                  {enRetard} en retard
                </span>
              </p>
              {regroupement === 'phase' && debut
                ? phases.map(groupe => (
                    <Section
                      key={groupe.phase?.cle ?? 'sans-echeance'}
                      titre={groupe.phase?.libelle ?? 'Sans échéance'}
                      compte={compteTaches(groupe.taches.length)}
                      extra={
                        groupe.phase && (
                          <span className="rt-note">
                            {libelleBorne(groupe.phase, activite.phases, debut)}
                          </span>
                        )
                      }
                    >
                      {plusieursPerimetres
                        ? groupe.perimetres.map(({ perimetre, taches: t }) => (
                            <div key={perimetre.id} className="rt-sous-section">
                              <h3 className="rt-sous-section-titre">
                                <EtiquettePerimetre
                                  nom={perimetre.nom}
                                  couleur={perimetre.couleur}
                                  lien={lien(
                                    `/perimetres/${perimetre.slug}?edition=${editionId}`
                                  )}
                                  point
                                />
                                <span className="rt-compte">
                                  {compteTaches(t.length)}
                                </span>
                              </h3>
                              {lignes(t, true)}
                            </div>
                          ))
                        : lignes(groupe.taches)}
                    </Section>
                  ))
                : groupes.map(groupe => (
                    <Section
                      key={groupe.mois ?? 'sans-echeance'}
                      titre={titreGroupe(groupe.mois)}
                      compte={compteTaches(groupe.taches.length)}
                    >
                      {lignes(groupe.taches)}
                    </Section>
                  ))}
            </>
          )}
        </DeuxColonnes>
      )}
    </>
  )
}
