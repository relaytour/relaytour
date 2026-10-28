import { BookOutlined, PlusOutlined, SolutionOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural, t as traduire } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, Button, Empty, Result, Skeleton } from 'antd'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import Avancement from '../composants/Avancement'
import ChoixEdition from '../composants/ChoixEdition'
import DeclinaisonsProposees from '../composants/DeclinaisonsProposees'
import FichesConnexes from '../composants/FichesConnexes'
import { DeuxColonnes, Groupe, Panneau } from '../composants/Panneau'
import {
  Avatar,
  MentionContactPrincipal,
  PersonneNommee,
} from '../composants/Personne'
import ProposerPersonne from '../composants/ProposerPersonne'
import ReunionFormulaire, {
  type NouvelleReunion,
} from '../composants/ReunionFormulaire'
import ReunionsDuPerimetre from '../composants/ReunionsDuPerimetre'
import SequencesDuPerimetre from '../composants/SequencesDuPerimetre'
import { Puces } from '../composants/Puces'
import TacheCarte from '../composants/TacheCarte'
import TacheFormulaire from '../composants/TacheFormulaire'
import Titre from '../composants/Titre'
import VersPremiersPas from '../composants/VersPremiersPas'
import { graphql } from '../gql'
import type { PagePerimetreQuery, TacheChampsFragment } from '../gql/graphql'
import { useGroupesReplies } from '../lib/groupes-replies'
import {
  CLE_GROUPES_REPLIES_TACHES,
  CLE_REGROUPEMENT_TACHES,
  ecrireRegroupement,
  grouperParFiche,
  grouperParPhase,
  libelleBorne,
  lireRegroupement,
} from '../lib/regroupement'
import { EDITION_COURANTE, EDITIONS, PERIMETRES } from '../lib/requetes'
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
        # Tâches partagées (ADR 0026) : pour une déclinaison, le périmètre qui la
        # demande ; pour une tâche partagée, où en sont ses déclinaisons.
        origine {
          id
          perimetre {
            slug
            nom
            couleur
          }
        }
        resumeDeclinaisons {
          total
          enAttente
          refusees
          acceptees
          faites
          abandonnees
        }
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
      # Les fiches d'autres périmètres qui concernent celui-ci (ADR 0039), masquées
      # comprises : l'écran sépare les deux listes.
      peutMasquerFichesConnexes
      fichesConnexes(inclureMasquees: true) {
        id
        slug
        titre
        perimetre {
          id
          nom
          couleur
        }
        connexions {
          masquee
          perimetre {
            id
          }
        }
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

// Regroupement de la liste (ADR 0025) : par échéance, la liste reste d'un seul
// tenant ; par phase ou par fiche, elle se découpe en groupes repliables. Le
// regroupement par phase vient en premier, et vaut par défaut quand l'activité
// déclare des phases.
type Regroupement = 'phase' | 'echeance' | 'fiche'
const REGROUPEMENTS = ['phase', 'echeance', 'fiche'] as const

const NOTE_REGROUPEMENT: Record<Regroupement, MessageDescriptor> = {
  echeance: msg`Les tâches sont triées par échéance. Une tâche ne se supprime pas : elle s’abandonne.`,
  phase: msg`Les tâches sont rangées par phase, puis par échéance. Une tâche se range dans une phase par son échéance. Une tâche ne se supprime pas : elle s’abandonne.`,
  fiche: msg`Les tâches sont rangées par fiche méthode, puis par échéance. Une tâche ne se supprime pas : elle s’abandonne.`,
}

// Une tâche de la page : le fragment commun et le résumé de ses déclinaisons.
type TacheDuPerimetre = NonNullable<
  PagePerimetreQuery['perimetre']
>['taches'][number]

interface SectionTaches {
  cle: string
  titre: ReactNode
  /** Le titre en texte, pour le bouton qui replie le groupe. */
  nom: string
  extra?: string
  taches: TacheDuPerimetre[]
}

const compteTaches = (n: number) =>
  traduire`${plural(n, { one: '# tâche', other: '# tâches' })}`

export default function Perimetre() {
  const { t, i18n } = useLingui()
  const { lien, periode, libelleGroupe, gere, activite } = useActivite()
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
  const parPhase = activite.phases.length > 0
  const [regroupementChoisi, setRegroupement] = useState<Regroupement>(() =>
    lireRegroupement(
      CLE_REGROUPEMENT_TACHES,
      REGROUPEMENTS,
      parPhase ? 'phase' : 'echeance'
    )
  )
  const groupes = useGroupesReplies(CLE_GROUPES_REPLIES_TACHES)
  const changerRegroupement = (valeur: Regroupement) => {
    setRegroupement(valeur)
    ecrireRegroupement(CLE_REGROUPEMENT_TACHES, valeur)
  }
  const [enEdition, setEnEdition] = useState<
    TacheChampsFragment | 'nouvelle' | null
  >(null)
  const [nouvelleReunion, setNouvelleReunion] =
    useState<NouvelleReunion | null>(null)

  const perimetre = data?.perimetre
  const consultation = perimetre?.acces === 'CONSULTATION'
  const { data: methode } = useQuery(FICHES, {
    variables: { slug },
    skip: perimetre?.acces !== 'COMPLET',
  })
  const fiches = methode?.perimetre?.fiches ?? []
  // Les autres périmètres de l'activité, où décliner une tâche (ADR 0026). Seule
  // une personne qui écrit dans le périmètre les lit.
  const { data: autres } = useQuery(PERIMETRES, {
    skip: !perimetre?.peutModifier,
  })
  const perimetresCibles = useMemo(
    () =>
      (autres?.perimetres ?? []).filter(
        p => !p.archive && p.id !== perimetre?.id
      ),
    [autres, perimetre?.id]
  )
  // La tâche visée par une notification (`?tache=`) s'affiche quel que soit le
  // filtre choisi : elle vient en tête quand le filtre l'aurait écartée.
  const tacheVisee = parametres.get('tache')
  const taches = useMemo(() => {
    const toutes = perimetre?.taches ?? []
    const filtrees = toutes.filter(FILTRES[filtre])
    const visee = toutes.find(x => x.id === tacheVisee)
    return visee !== undefined && !filtrees.includes(visee)
      ? [visee, ...filtrees]
      : filtrees
  }, [perimetre, filtre, tacheVisee])
  // Dans une section, la tâche visée garde sa place par échéance : la liste du
  // serveur est déjà triée, et la tâche visée y reste quel que soit le filtre.
  const tachesParEcheance = useMemo(
    () =>
      (perimetre?.taches ?? []).filter(
        x => FILTRES[filtre](x) || x.id === tacheVisee
      ),
    [perimetre, filtre, tacheVisee]
  )

  // En consultation, le serveur ne rend pas les fiches (ADR 0014) : le regroupement
  // par fiche n'est proposé qu'avec un accès complet.
  const parFiche = perimetre?.acces === 'COMPLET'
  const regroupement: Regroupement =
    (regroupementChoisi === 'fiche' && !parFiche) ||
    (regroupementChoisi === 'phase' && !parPhase)
      ? 'echeance'
      : regroupementChoisi
  // Le premier jour de la période : les bornes des phases se comptent depuis lui.
  const debut = editions?.editions.find(e => e.id === editionId)?.debut
  const sections = useMemo((): SectionTaches[] | null => {
    if (regroupement === 'phase' && debut) {
      return grouperParPhase(tachesParEcheance, activite.phases, debut).map(
        groupe => {
          const titre = groupe.phase?.libelle ?? t`Sans échéance`
          return {
            // Une activité peut déclarer une phase « sans-echeance » : le préfixe
            // garde la clé du groupe sans échéance distincte.
            cle:
              groupe.phase === null
                ? 'sans-echeance'
                : `phase:${groupe.phase.cle}`,
            titre,
            nom: titre,
            extra:
              groupe.phase === null
                ? undefined
                : libelleBorne(groupe.phase, activite.phases, debut),
            taches: groupe.taches,
          }
        }
      )
    }
    if (regroupement === 'fiche') {
      return grouperParFiche(tachesParEcheance).map(groupe => ({
        cle: groupe.fiche === null ? 'sans-fiche' : `fiche:${groupe.fiche.id}`,
        titre:
          groupe.fiche === null ? (
            t`Sans fiche`
          ) : (
            <Link to={lien(`/fiches/${groupe.fiche.slug}`)}>
              {groupe.fiche.titre}
            </Link>
          ),
        nom: groupe.fiche?.titre ?? t`Sans fiche`,
        taches: groupe.taches,
      }))
    }
    // Par échéance, ou tant que la période n'est pas chargée : la liste d'un tenant.
    return null
  }, [regroupement, debut, tachesParEcheance, activite.phases, lien, t])

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

  const aucunePeriode = periode.Aucune
  const cettePeriode = periode.cette
  const cettePeriodeMajuscule = `${cettePeriode.charAt(0).toUpperCase()}${cettePeriode.slice(1)}`
  const periodeArchivee = periode.archivee
  if (error) {
    return (
      <Result status="403" title={t`Vous n’avez pas accès à ce périmètre.`} />
    )
  }
  if (editionId === undefined && courante && !courante.editionCourante) {
    return (
      <Result
        status="info"
        title={t`${aucunePeriode} n’est en préparation.`}
        extra={<VersPremiersPas />}
      />
    )
  }
  // L'écran garde son contenu pendant une relecture : seul un premier chargement
  // affiche le squelette.
  if (!data) return <Skeleton active />
  if (!perimetre || !data.moi)
    return <Result status="404" title={t`Ce périmètre est introuvable.`} />

  const moiId = data.moi.id
  const contactId = perimetre.contactPrincipal?.id
  const edition = editions?.editions.find(e => e.id === editionId)
  const a = perimetre.avancement
  const titreDeReunion = (titreTache: string) => t`Réunion : ${titreTache}`
  const cartes = (liste: TacheDuPerimetre[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {liste.map(tache => (
        <TacheCarte
          key={tache.id}
          tache={tache}
          moiId={moiId}
          peutModifier={perimetre.peutModifier}
          referents={perimetre.referents}
          estAdmin={gere}
          enEvidence={tache.id === tacheVisee}
          filOuvert={tache.id === tacheVisee && parametres.get('fil') === '1'}
          onModifier={setEnEdition}
          onPlanifierReunion={tacheLiee =>
            setNouvelleReunion({
              perimetreId: perimetre.id,
              titre: titreDeReunion(tacheLiee.titre),
              tacheIds: [tacheLiee.id],
            })
          }
          perimetresCibles={perimetresCibles}
          editionId={editionId}
        />
      ))}
    </div>
  )

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
                    <span>
                      <Trans>Référent·es :</Trans>
                    </span>
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
                          nom={r.id === moiId ? t`Vous` : r.nom}
                          initialesDe={r.nom}
                        />
                        {r.id === contactId && <MentionContactPrincipal />}
                      </span>
                    ))}
                  </span>
                ) : (
                  t`Aucune personne n’est affectée à ce périmètre pour ${cettePeriode}.`
                )}
              </>
            }
            actions={
              <>
                <ChoixEdition
                  valeur={editionId}
                  onChange={id => setParametres({ edition: id })}
                />
                {gere && (
                  <Button
                    size="large"
                    icon={<SolutionOutlined />}
                    onClick={() =>
                      void navigate(
                        lien(
                          `/admin/equipe?${new URLSearchParams({
                            ...(editionId ? { edition: editionId } : {}),
                            q: perimetre.nom,
                          })}`
                        )
                      )
                    }
                  >
                    <Trans>Gérer l’équipe</Trans>
                  </Button>
                )}
                {perimetre.peutModifier && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    onClick={() => setEnEdition('nouvelle')}
                  >
                    <Trans>Nouvelle tâche</Trans>
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
          title={t`Vous consultez ce périmètre sans y être affecté·e.`}
          description={
            <Trans>
              Vous lisez ses tâches et son équipe. Vous ne pouvez pas les
              modifier. Pour rejoindre ce périmètre, formulez un souhait dans{' '}
              <Link to={lien('/perimetres')}>Tous les périmètres</Link>.
            </Trans>
          }
        />
      )}

      {!perimetre.peutModifier && edition?.statut === 'ARCHIVEE' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={t`${cettePeriodeMajuscule} est ${periodeArchivee}. Ses tâches sont consultables en lecture seule.`}
        />
      )}

      <DeuxColonnes
        cote={
          <>
            <Panneau
              titre={t`Avancement`}
              extra={<span className="rt-compte">{edition?.annee}</span>}
            >
              <Avancement avancement={a} />
            </Panneau>

            {perimetre.acces === 'COMPLET' && (
              <Panneau
                titre={t`Fiches méthode`}
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
                      <Trans>Nouvelle fiche</Trans>
                    </Button>
                  )
                }
              >
                {fiches.length === 0 ? (
                  <p className="rt-texte-secondaire">
                    <Trans>Aucune fiche pour ce périmètre.</Trans>
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

            {perimetre.acces === 'COMPLET' && methode?.perimetre && (
              <FichesConnexes
                perimetreId={methode.perimetre.id}
                fiches={methode.perimetre.fichesConnexes}
                peutMasquer={methode.perimetre.peutMasquerFichesConnexes}
              />
            )}

            {perimetre.referents.length > 0 && (
              <Panneau titre={t`Personnes affectées`}>
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
                          {r.id === moiId ? t`Vous` : r.nom}
                        </span>
                        {r.id === contactId && <MentionContactPrincipal />}
                        <span
                          className="rt-compte"
                          style={{ marginInlineStart: 'auto' }}
                        >
                          {compteTaches(charge)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
                <p className="rt-note">
                  <Trans>
                    Le nombre compte les tâches ouvertes assignées à chaque
                    personne.
                  </Trans>
                </p>
              </Panneau>
            )}

            {editionId && (
              <SequencesDuPerimetre
                perimetreId={perimetre.id}
                editionId={editionId}
              />
            )}

            {editionId && (
              <ReunionsDuPerimetre
                perimetreId={perimetre.id}
                editionId={editionId}
                peutModifier={perimetre.peutModifier}
                onNouvelle={() =>
                  setNouvelleReunion({ perimetreId: perimetre.id })
                }
              />
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
        {editionId && (
          <DeclinaisonsProposees
            slug={slug}
            editionId={editionId}
            peutRepondre={perimetre.peutModifier}
          />
        )}

        {/* Deux lignes de puces : le statut, puis le regroupement. Sur une seule
            ligne, le second groupe passerait à la ligne en laissant son trait. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Puces<Filtre>
            libelle={t`Statut des tâches`}
            valeur={filtre}
            onChange={setFiltre}
            options={[
              {
                valeur: 'ouvertes',
                libelle: t({
                  message: 'Ouvertes',
                  comment: 'Filtre : les tâches ni faites ni abandonnées',
                }),
                compte: a.aFaire + a.enCours,
              },
              { valeur: 'retard', libelle: t`En retard`, compte: a.enRetard },
              {
                valeur: 'faites',
                libelle: t({
                  message: 'Faites',
                  comment: 'Filtre : les tâches faites',
                }),
                compte: a.faites,
              },
              {
                valeur: 'abandonnees',
                libelle: t({
                  message: 'Abandonnées',
                  comment: 'Filtre : les tâches abandonnées',
                }),
                compte: a.abandonnees,
              },
              {
                valeur: 'toutes',
                libelle: t({
                  message: 'Toutes',
                  comment: 'Filtre : toutes les tâches',
                }),
                compte: a.total,
              },
            ]}
          />
          <Puces<Regroupement>
            libelle={t`Regroupement des tâches`}
            valeur={regroupement}
            onChange={changerRegroupement}
            options={[
              ...(parPhase
                ? [{ valeur: 'phase' as const, libelle: t`Par phase` }]
                : []),
              { valeur: 'echeance', libelle: t`Par échéance` },
              ...(parFiche
                ? [{ valeur: 'fiche' as const, libelle: t`Par fiche` }]
                : []),
            ]}
          />
        </div>

        {taches.length === 0 ? (
          <div className="rt-verre rt-panneau">
            <Empty description={t`Aucune tâche dans cette catégorie.`} />
          </div>
        ) : sections === null ? (
          cartes(taches)
        ) : (
          sections.map(section => (
            <Groupe
              key={section.cle}
              titre={section.titre}
              nom={section.nom}
              compte={compteTaches(section.taches.length)}
              extra={
                section.extra && (
                  <span className="rt-note">{section.extra}</span>
                )
              }
              // La tâche visée par une notification reste visible.
              replie={
                groupes.estReplie(section.cle) &&
                !section.taches.some(x => x.id === tacheVisee)
              }
              onBasculer={() => groupes.basculer(section.cle)}
            >
              {cartes(section.taches)}
            </Groupe>
          ))
        )}

        <p className="rt-note" style={{ margin: '0 6px' }}>
          {i18n._(
            NOTE_REGROUPEMENT[sections === null ? 'echeance' : regroupement]
          )}
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
          perimetresCibles={perimetresCibles}
          estAdmin={gere}
          onFermer={() => setEnEdition(null)}
          onEnregistree={() => setEnEdition(null)}
        />
      )}
      {editionId && perimetre.peutModifier && (
        <ReunionFormulaire
          editionId={editionId}
          agendas={[{ perimetreId: perimetre.id, nom: perimetre.nom }]}
          reunion={nouvelleReunion}
          onFermer={() => setNouvelleReunion(null)}
        />
      )}
    </>
  )
}
