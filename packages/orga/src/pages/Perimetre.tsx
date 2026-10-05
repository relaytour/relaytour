import { BookOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Alert, Button, Empty, Result, Skeleton } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import Avancement from '../composants/Avancement'
import ChoixEdition from '../composants/ChoixEdition'
import { DeuxColonnes, Panneau } from '../composants/Panneau'
import {
  Avatar,
  MentionContactPrincipal,
  PersonneNommee,
} from '../composants/Personne'
import ProposerPersonne from '../composants/ProposerPersonne'
import { Puces } from '../composants/Puces'
import TacheCarte from '../composants/TacheCarte'
import TacheFormulaire from '../composants/TacheFormulaire'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { TacheChampsFragment } from '../gql/graphql'
import { EDITION_COURANTE, EDITIONS } from '../lib/requetes'
import { estOuverte } from '../lib/taches'
import { useActivite } from '../lib/activite'

const PAGE = graphql(`
  query PagePerimetre($slug: String!, $editionId: ID!) {
    moi {
      id
    }
    perimetre(slug: $slug) {
      id
      nom
      description
      groupe
      couleur
      acces
      peutModifier(editionId: $editionId)
      referents(editionId: $editionId) {
        id
        nom
      }
      contactPrincipal(editionId: $editionId) {
        id
      }
      avancement(editionId: $editionId) {
        total
        aFaire
        enCours
        faites
        abandonnees
        enRetard
        sansPersonne
      }
      taches(editionId: $editionId) {
        ...TacheChamps
      }
    }
    fichesCommunes: fiches {
      id
      titre
      perimetre {
        id
      }
    }
  }
`)

// Les fiches d'un périmètre suivent la règle de lecture (ADR 0014) : le serveur les
// refuse en consultation. Elles se demandent à part, avec un accès complet seulement.
const FICHES = graphql(`
  query FichesDuPerimetre($slug: String!) {
    perimetre(slug: $slug) {
      id
      peutRedigerFiches
      fiches {
        id
        slug
        titre
      }
    }
  }
`)

type Filtre = 'ouvertes' | 'retard' | 'faites' | 'abandonnees' | 'toutes'

const FILTRES: Record<Filtre, (t: TacheChampsFragment) => boolean> = {
  ouvertes: t => t.statut === 'A_FAIRE' || t.statut === 'EN_COURS',
  retard: t => t.enRetard,
  faites: t => t.statut === 'FAITE',
  abandonnees: t => t.statut === 'ABANDONNEE',
  toutes: () => true,
}

export default function Perimetre() {
  const { lien, periode, libelleGroupe, gere } = useActivite()
  const { slug = '' } = useParams()
  const [parametres, setParametres] = useSearchParams()
  const navigate = useNavigate()
  const { data: courante } = useQuery(EDITION_COURANTE)
  const { data: editions } = useQuery(EDITIONS)
  const editionId = parametres.get('edition') ?? courante?.editionCourante?.id
  const { data, error } = useQuery(PAGE, {
    variables: { slug, editionId: editionId ?? '' },
    skip: editionId === undefined,
  })
  const [filtre, setFiltre] = useState<Filtre>('ouvertes')
  const [enEdition, setEnEdition] = useState<
    TacheChampsFragment | 'nouvelle' | null
  >(null)

  const perimetre = data?.perimetre
  const consultation = perimetre?.acces === 'CONSULTATION'
  const { data: methode } = useQuery(FICHES, {
    variables: { slug },
    skip: perimetre?.acces !== 'COMPLET',
  })
  const fiches = methode?.perimetre?.fiches ?? []
  // La tâche visée par une notification (`?tache=`) s'affiche quel que soit le
  // filtre choisi : elle vient en tête quand le filtre l'aurait écartée.
  const tacheVisee = parametres.get('tache')
  const taches = useMemo(() => {
    const toutes = perimetre?.taches ?? []
    const filtrees = toutes.filter(FILTRES[filtre])
    const visee = toutes.find(t => t.id === tacheVisee)
    return visee !== undefined && !filtrees.includes(visee)
      ? [visee, ...filtrees]
      : filtrees
  }, [perimetre, filtre, tacheVisee])

  // Le nombre de tâches ouvertes de chaque personne affectée au périmètre.
  const chargeDe = useMemo(() => {
    const charge = new Map<string, number>()
    for (const tache of perimetre?.taches ?? []) {
      if (!estOuverte(tache)) continue
      for (const p of tache.assignes)
        charge.set(p.id, (charge.get(p.id) ?? 0) + 1)
    }
    return charge
  }, [perimetre])

  if (error) {
    return <Result status="403" title="Vous n’avez pas accès à ce périmètre." />
  }
  if (editionId === undefined && courante && !courante.editionCourante) {
    return (
      <Result status="info" title={`${periode.Aucune} n’est en préparation.`} />
    )
  }
  // L'écran garde son contenu pendant une relecture : seul un premier chargement
  // affiche le squelette.
  if (!data) return <Skeleton active />
  if (!perimetre || !data.moi)
    return <Result status="404" title="Ce périmètre est introuvable." />

  const moiId = data.moi.id
  const contactId = perimetre.contactPrincipal?.id
  const edition = editions?.editions.find(e => e.id === editionId)
  const a = perimetre.avancement

  return (
    <>
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <span
          className="rt-rail"
          style={{
            width: 8,
            marginBottom: 22,
            background: perimetre.couleur ?? 'var(--rt-primaire)',
          }}
          aria-hidden="true"
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Titre
            sousTitre={
              <>
                {perimetre.description && (
                  <span
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      color: 'var(--rt-encre)',
                      maxWidth: '70ch',
                    }}
                  >
                    {perimetre.description}
                  </span>
                )}
                {perimetre.referents.length > 0 ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '6px 12px',
                    }}
                  >
                    <span>Référent·es :</span>
                    {perimetre.referents.map(r => (
                      <span
                        key={r.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <PersonneNommee
                          nom={r.id === moiId ? 'Vous' : r.nom}
                          initialesDe={r.nom}
                        />
                        {r.id === contactId && <MentionContactPrincipal />}
                      </span>
                    ))}
                  </span>
                ) : (
                  `Aucune personne n’est affectée à ce périmètre pour ${periode.cette}.`
                )}
              </>
            }
            actions={
              <>
                <ChoixEdition
                  valeur={editionId}
                  onChange={id => setParametres({ edition: id })}
                />
                {perimetre.peutModifier && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    onClick={() => setEnEdition('nouvelle')}
                  >
                    Nouvelle tâche
                  </Button>
                )}
              </>
            }
          >
            <span
              style={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {perimetre.nom}
              <span
                className="rt-libelle rt-verre"
                style={{ padding: '4px 10px', borderRadius: 999 }}
              >
                {libelleGroupe(perimetre.groupe)}
              </span>
            </span>
          </Titre>
        </div>
      </div>

      {consultation && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Vous consultez ce périmètre sans y être affecté·e."
          description={
            <>
              Vous lisez ses tâches et son équipe. Vous ne pouvez pas les
              modifier. Pour rejoindre ce périmètre, formulez un souhait dans{' '}
              <Link to={lien('/perimetres')}>Tous les périmètres</Link>.
            </>
          }
        />
      )}

      {!perimetre.peutModifier && edition?.statut === 'ARCHIVEE' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${periode.cette.charAt(0).toUpperCase()}${periode.cette.slice(1)} est ${periode.archivee}. Ses tâches sont consultables en lecture seule.`}
        />
      )}

      <DeuxColonnes
        cote={
          <>
            <Panneau
              titre="Avancement"
              extra={<span className="rt-compte">{edition?.annee}</span>}
            >
              <Avancement avancement={a} />
            </Panneau>

            {perimetre.acces === 'COMPLET' && (
              <Panneau
                titre="Fiches méthode"
                icone={<BookOutlined aria-hidden />}
                extra={
                  methode?.perimetre?.peutRedigerFiches && (
                    <Button
                      size="small"
                      type="link"
                      onClick={() =>
                        navigate(lien(`/fiches/nouvelle?perimetre=${slug}`))
                      }
                    >
                      Nouvelle fiche
                    </Button>
                  )
                }
              >
                {fiches.length === 0 ? (
                  <p className="rt-texte-secondaire">
                    Aucune fiche pour ce périmètre.
                  </p>
                ) : (
                  <ul className="rt-liste-liens">
                    {fiches.map(f => (
                      <li key={f.id}>
                        <Link
                          className="rt-ligne-lien"
                          style={{ fontSize: 13.5 }}
                          to={lien(`/fiches/${f.slug}`)}
                        >
                          {f.titre}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panneau>
            )}

            {perimetre.referents.length > 0 && (
              <Panneau titre="Personnes affectées">
                <ul
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                  }}
                >
                  {perimetre.referents.map(r => {
                    const charge = chargeDe.get(r.id) ?? 0
                    return (
                      <li
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          fontSize: 14,
                        }}
                      >
                        <Avatar nom={r.nom} taille={28} />
                        <span style={{ fontWeight: 600 }}>
                          {r.id === moiId ? 'Vous' : r.nom}
                        </span>
                        {r.id === contactId && <MentionContactPrincipal />}
                        <span
                          className="rt-compte"
                          style={{ marginInlineStart: 'auto' }}
                        >
                          {charge} {charge > 1 ? 'tâches' : 'tâche'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <p className="rt-note">
                  Le nombre compte les tâches ouvertes assignées à chaque
                  personne.
                </p>
              </Panneau>
            )}

            {perimetre.peutModifier && editionId && (
              <ProposerPersonne
                perimetreId={perimetre.id}
                perimetreNom={perimetre.nom}
                editionId={editionId}
              />
            )}
          </>
        }
      >
        <div
          className="rt-puces"
          style={{ justifyContent: 'space-between', rowGap: 10 }}
        >
          <Puces<Filtre>
            libelle="Statut des tâches"
            valeur={filtre}
            onChange={setFiltre}
            options={[
              {
                valeur: 'ouvertes',
                libelle: 'Ouvertes',
                compte: a.aFaire + a.enCours,
              },
              { valeur: 'retard', libelle: 'En retard', compte: a.enRetard },
              { valeur: 'faites', libelle: 'Faites', compte: a.faites },
              {
                valeur: 'abandonnees',
                libelle: 'Abandonnées',
                compte: a.abandonnees,
              },
              { valeur: 'toutes', libelle: 'Toutes', compte: a.total },
            ]}
          />
          <span className="rt-note">Triées par échéance</span>
        </div>

        {taches.length === 0 ? (
          <div className="rt-verre rt-panneau">
            <Empty description="Aucune tâche dans cette catégorie." />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {taches.map(tache => (
              <TacheCarte
                key={tache.id}
                tache={tache}
                moiId={moiId}
                peutModifier={perimetre.peutModifier}
                referents={perimetre.referents}
                estAdmin={gere}
                enEvidence={tache.id === tacheVisee}
                onModifier={setEnEdition}
              />
            ))}
          </div>
        )}

        <p className="rt-note" style={{ margin: '0 6px' }}>
          Les tâches sont triées par échéance. Une tâche ne se supprime pas :
          elle s’abandonne.
        </p>
      </DeuxColonnes>

      {editionId && (
        <TacheFormulaire
          tache={enEdition}
          perimetreId={perimetre.id}
          editionId={editionId}
          fiches={(data.fichesCommunes ?? []).filter(
            f => f.perimetre === null || f.perimetre.id === perimetre.id
          )}
          onFermer={() => setEnEdition(null)}
          onEnregistree={() => setEnEdition(null)}
        />
      )}
    </>
  )
}
