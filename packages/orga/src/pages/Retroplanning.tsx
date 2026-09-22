import { useQuery } from '@apollo/client/react'
import { Empty, Result, Select, Skeleton } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import ChoixEdition from '../composants/ChoixEdition'
import LigneTache from '../composants/LigneTache'
import { DeuxColonnes, Panneau, Section } from '../composants/Panneau'
import PastillePerimetre from '../composants/PastillePerimetre'
import { PuceBascule, Puces, SeparateurPuces } from '../composants/Puces'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { TypePerimetre } from '../gql/graphql'
import { EDITION_COURANTE } from '../lib/requetes'
import { grouperParMois, libelleMois } from '../lib/retroplanning'
import { estOuverte } from '../lib/taches'

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
        type
        couleur
      }
      assignes {
        id
        nom
      }
    }
  }
`)

type FiltreType = 'tous' | TypePerimetre
type FiltreStatut = 'ouvertes' | 'toutes'

function titreGroupe(mois: string | null): string {
  if (mois === null) return 'Sans échéance'
  const libelle = libelleMois(mois)
  return libelle.charAt(0).toUpperCase() + libelle.slice(1)
}

export default function Retroplanning() {
  const [parametres, setParametres] = useSearchParams()
  const { data: courante } = useQuery(EDITION_COURANTE)
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

  const moi = data?.moi
  const toutes = data?.retroplanning

  // Les options du filtre : les périmètres présents dans le résultat, sports puis pôles.
  const options = useMemo(() => {
    const presents = [
      ...new Map((toutes ?? []).map(t => [t.perimetre.id, t.perimetre])),
    ]
      .map(([, p]) => p)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    return [
      { type: 'SPORT', label: 'Sports' },
      { type: 'POLE', label: 'Pôles' },
    ]
      .map(groupe => ({
        label: groupe.label,
        options: presents
          .filter(p => p.type === groupe.type)
          .map(p => ({ value: p.id, label: p.nom, couleur: p.couleur })),
      }))
      .filter(groupe => groupe.options.length > 0)
  }, [toutes])

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
          (type === 'tous' || t.perimetre.type === type) &&
          (statut === 'toutes' || estOuverte(t)) &&
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
    return <Result status="info" title="Aucune édition n’est en préparation." />
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
        sousTitre="Les tâches de l’édition sont regroupées par mois, de la plus proche à la plus lointaine."
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
        <Puces<FiltreType>
          libelle="Type de périmètre"
          valeur={type}
          onChange={setType}
          options={[
            { valeur: 'tous', libelle: 'Tous' },
            { valeur: 'SPORT', libelle: 'Sports' },
            { valeur: 'POLE', libelle: 'Pôles' },
          ]}
        />
        <SeparateurPuces />
        <Puces<FiltreStatut>
          libelle="Statut des tâches"
          valeur={statut}
          onChange={setStatut}
          options={[
            { valeur: 'ouvertes', libelle: 'Ouvertes' },
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
                          to={`/perimetres/${t.perimetre.slug}?edition=${editionId}`}
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
          (mesPerimetres || (!moi.estAdmin && toutes?.length === 0)) ? (
            <div className="rt-verre rt-panneau">
              <Empty description="Vous n’êtes affecté·e à aucun périmètre pour cette édition." />
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
              {groupes.map(groupe => (
                <Section
                  key={groupe.mois ?? 'sans-echeance'}
                  titre={titreGroupe(groupe.mois)}
                  compte={`${groupe.taches.length} ${groupe.taches.length > 1 ? 'tâches' : 'tâche'}`}
                >
                  <ul className="rt-liste-liens" style={{ gap: 8 }}>
                    {groupe.taches.map(tache => (
                      <LigneTache
                        key={tache.id}
                        tache={tache}
                        moiId={moi.id}
                        editionId={editionId ?? ''}
                      />
                    ))}
                  </ul>
                </Section>
              ))}
            </>
          )}
        </DeuxColonnes>
      )}
    </>
  )
}
