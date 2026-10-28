import { useQuery } from '@apollo/client/react'
import { plural, t as traduire } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Empty, Result, Select, Skeleton, Space } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import ChoixEdition from '../composants/ChoixEdition'
import EtiquettePerimetre from '../composants/EtiquettePerimetre'
import LigneTache, { LigneDeclinaisons } from '../composants/LigneTache'
import { DeuxColonnes, Groupe, Panneau } from '../composants/Panneau'
import PastillePerimetre from '../composants/PastillePerimetre'
import { PuceBascule, Puces, SeparateurPuces } from '../composants/Puces'
import Titre from '../composants/Titre'
import VersPremiersPas from '../composants/VersPremiersPas'
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
import { useGroupesReplies } from '../lib/groupes-replies'
import { grouperParMois, libelleMois } from '../lib/retroplanning'
import { estOuverte } from '../lib/taches'
import { useActivite } from '../lib/activite'
import { regrouperDeclinaisons } from '../lib/declinaisons'
import { comparerTextes } from '../lib/langue'

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
      # Pour réunir les déclinaisons d'une même tâche partagée (ADR 0026).
      origine {
        id
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

const compteTaches = (n: number) =>
  traduire`${plural(n, { one: '# tâche', other: '# tâches' })}`

function titreGroupe(mois: string | null): string {
  if (mois === null) return traduire`Sans échéance`
  const libelle = libelleMois(mois)
  return libelle.charAt(0).toUpperCase() + libelle.slice(1)
}

export default function Retroplanning() {
  const { t } = useLingui()
  const { lien, periode, activite, gere } = useActivite()
  const navigate = useNavigate()
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
  const replies = useGroupesReplies('retroplanning')
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
      ...new Map((toutes ?? []).map(x => [x.perimetre.id, x.perimetre])),
    ]
      .map(([, p]) => p)
      .sort((a, b) => comparerTextes(a.nom, b.nom))
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
      new Map((toutes ?? []).map(x => [x.perimetre.id, x.perimetre.couleur])),
    [toutes]
  )

  const affectes = useMemo(
    () => new Set((moi?.affectations ?? []).map(a => a.perimetre.id)),
    [moi]
  )

  const taches = useMemo(
    () =>
      (toutes ?? []).filter(
        x =>
          (perimetres.length === 0 || perimetres.includes(x.perimetre.id)) &&
          (type === 'tous' || x.perimetre.groupe === type) &&
          (statut === 'toutes' ||
            (statut === 'retard' ? x.enRetard : estOuverte(x))) &&
          (!mesPerimetres || affectes.has(x.perimetre.id)) &&
          (!assigneesAMoi || x.assignes.some(p => p.id === moi?.id))
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
    () => new Set(taches.map(x => x.perimetre.id)).size > 1,
    [taches]
  )

  // Les tâches ouvertes sans personne dans les périmètres de l'édition où la
  // personne est affectée : elle peut les prendre depuis leur périmètre.
  const aPrendre = useMemo(
    () =>
      (toutes ?? []).filter(
        x =>
          estOuverte(x) &&
          x.assignes.length === 0 &&
          affectes.has(x.perimetre.id)
      ),
    [toutes, affectes]
  )

  const aucunePeriode = periode.Aucune
  const cettePeriode = periode.cette
  const dePeriode = periode.de
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
        title={t`Le rétroplanning n’a pas pu être chargé.`}
        subTitle={t`Rechargez la page dans un instant.`}
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
  // Par mois, les déclinaisons d'une même tâche partagée qui tombent le même jour
  // tiennent sur une ligne : la liste ne répète pas la tâche pour chaque périmètre.
  const lignesDuMois = (liste: typeof taches) => (
    <ul className="rt-liste-liens" style={{ gap: 8 }}>
      {regrouperDeclinaisons(liste).map(ligne =>
        ligne.sorte === 'tache' ? (
          <LigneTache
            key={ligne.tache.id}
            tache={ligne.tache}
            moiId={moi?.id ?? ''}
            editionId={editionId ?? ''}
          />
        ) : (
          <LigneDeclinaisons
            key={ligne.cle}
            titre={ligne.titre}
            taches={ligne.taches}
            moiId={moi?.id ?? ''}
            editionId={editionId ?? ''}
          />
        )
      )}
    </ul>
  )

  const enRetard = taches.filter(x => x.enRetard).length
  const nombreTaches = taches.length
  const nombreAPrendre = aPrendre.length
  const repartition = [
    {
      cle: 'A_FAIRE',
      nom: t({ message: 'À faire', comment: 'Statut d’une tâche' }),
      nombre: taches.filter(x => x.statut === 'A_FAIRE').length,
      couleur: 'var(--rt-encre-40)',
    },
    {
      cle: 'EN_COURS',
      nom: t({ message: 'En cours', comment: 'Statut d’une tâche' }),
      nombre: taches.filter(x => x.statut === 'EN_COURS').length,
      couleur: 'var(--rt-primaire)',
    },
    {
      cle: 'FAITE',
      nom: t({
        message: 'Faites',
        comment: 'Nombre de tâches faites, au pluriel',
      }),
      nombre: taches.filter(x => x.statut === 'FAITE').length,
      couleur: 'var(--rt-succes)',
    },
    {
      cle: 'ABANDONNEE',
      nom: t({
        message: 'Abandonnées',
        comment: 'Nombre de tâches abandonnées, au pluriel',
      }),
      nombre: taches.filter(x => x.statut === 'ABANDONNEE').length,
      couleur: 'var(--rt-encre-14)',
    },
    {
      cle: 'RETARD',
      nom: t`En retard`,
      nombre: enRetard,
      couleur: 'var(--rt-erreur)',
    },
  ].filter(r => r.nombre > 0 || r.cle === 'RETARD')

  return (
    <>
      <Titre
        sousTitre={
          regroupement === 'phase'
            ? t`Les tâches ${dePeriode} sont rangées par phase, puis par périmètre.`
            : t`Les tâches ${dePeriode} sont regroupées par mois, de la plus proche à la plus lointaine.`
        }
        actions={
          <Space wrap>
            <ChoixEdition
              valeur={editionId}
              onChange={id => {
                setPerimetres([])
                setParametres({ edition: id })
              }}
            />
            {gere && (
              <Button onClick={() => navigate(lien('/admin/import/taches'))}>
                <Trans>Importer des tâches</Trans>
              </Button>
            )}
          </Space>
        }
      >
        <Trans>Rétroplanning</Trans>
      </Titre>

      <div className="rt-puces" style={{ marginBottom: 22, rowGap: 10 }}>
        <Puces<Regroupement>
          libelle={t`Regroupement des tâches`}
          valeur={regroupementChoisi}
          onChange={changerRegroupement}
          options={[
            { valeur: 'mois', libelle: t`Par mois` },
            { valeur: 'phase', libelle: t`Par phase` },
          ]}
        />
        <SeparateurPuces />
        <Puces<FiltreType>
          libelle={t`Groupe de périmètres`}
          valeur={type}
          onChange={setType}
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
        <Puces<FiltreStatut>
          libelle={t`Statut des tâches`}
          valeur={statut}
          onChange={setStatut}
          options={[
            {
              valeur: 'ouvertes',
              libelle: t({
                message: 'Ouvertes',
                comment: 'Filtre : les tâches ni faites ni abandonnées',
              }),
            },
            { valeur: 'retard', libelle: t`En retard` },
            {
              valeur: 'toutes',
              libelle: t({
                message: 'Toutes',
                comment: 'Filtre : toutes les tâches',
              }),
            },
          ]}
        />
        <SeparateurPuces />
        <PuceBascule actif={mesPerimetres} onChange={setMesPerimetres}>
          <Trans>Mes périmètres</Trans>
        </PuceBascule>
        <PuceBascule actif={assigneesAMoi} onChange={setAssigneesAMoi}>
          <Trans>Assignées à moi</Trans>
        </PuceBascule>
        <Select
          mode="multiple"
          maxTagCount="responsive"
          allowClear
          aria-label={t`Périmètres`}
          placeholder={t`Tous les périmètres`}
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
                titre={t`Sur cette sélection`}
                extra={
                  <span className="rt-compte">
                    {compteTaches(taches.length)}
                  </span>
                }
              >
                {repartition.map(r => (
                  <div
                    key={r.cle}
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
                  titre={t`${plural(nombreAPrendre, {
                    one: 'Une tâche attend une personne',
                    other: '# tâches attendent une personne',
                  })}`}
                >
                  <p className="rt-texte-secondaire">
                    <Trans>
                      Ces tâches ouvertes de vos périmètres n’ont aucune
                      personne assignée. Vous pouvez les prendre depuis leur
                      périmètre.
                    </Trans>
                  </p>
                  <ul className="rt-liste-liens">
                    {aPrendre.slice(0, 5).map(x => (
                      <li key={x.id}>
                        <Link
                          className="rt-ligne-lien"
                          to={lien(
                            `/perimetres/${x.perimetre.slug}?edition=${editionId}`
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
                                  x.perimetre.couleur ?? 'var(--rt-primaire)',
                              }}
                            />
                            {x.titre}
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
                description={t`Vous n’êtes affecté·e à aucun périmètre pour ${cettePeriode}.`}
              />
            </div>
          ) : taches.length === 0 ? (
            <div className="rt-verre rt-panneau">
              <Empty
                description={t`Aucune tâche ne correspond à ces filtres.`}
              />
            </div>
          ) : (
            <>
              <p style={{ margin: '0 6px', fontWeight: 600 }}>
                {taches.length === 1 ? (
                  <Trans>
                    1 tâche, dont{' '}
                    <span
                      style={{
                        color: enRetard > 0 ? 'var(--rt-erreur)' : undefined,
                      }}
                    >
                      {enRetard} en retard
                    </span>
                  </Trans>
                ) : (
                  <Trans>
                    {nombreTaches} tâches, dont{' '}
                    <span
                      style={{
                        color: enRetard > 0 ? 'var(--rt-erreur)' : undefined,
                      }}
                    >
                      {enRetard} en retard
                    </span>
                  </Trans>
                )}
              </p>
              {regroupement === 'phase' && debut
                ? phases.map(groupe => {
                    // Le préfixe garde la clé du groupe sans échéance distincte
                    // d'une phase qui porterait ce nom.
                    const cle =
                      groupe.phase === null
                        ? 'sans-echeance'
                        : `phase:${groupe.phase.cle}`
                    const titre = groupe.phase?.libelle ?? t`Sans échéance`
                    return (
                      <Groupe
                        key={cle}
                        titre={titre}
                        nom={titre}
                        replie={replies.estReplie(cle)}
                        onBasculer={() => replies.basculer(cle)}
                        compte={compteTaches(groupe.taches.length)}
                        extra={
                          groupe.phase && (
                            <span className="rt-note">
                              {libelleBorne(
                                groupe.phase,
                                activite.phases,
                                debut
                              )}
                            </span>
                          )
                        }
                      >
                        {plusieursPerimetres
                          ? groupe.perimetres.map(
                              ({ perimetre, taches: duPerimetre }) => (
                                <div
                                  key={perimetre.id}
                                  className="rt-sous-section"
                                >
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
                                      {compteTaches(duPerimetre.length)}
                                    </span>
                                  </h3>
                                  {lignes(duPerimetre, true)}
                                </div>
                              )
                            )
                          : lignes(groupe.taches)}
                      </Groupe>
                    )
                  })
                : groupes.map(groupe => {
                    const cle =
                      groupe.mois === null
                        ? 'sans-echeance'
                        : `mois:${groupe.mois}`
                    const titre = titreGroupe(groupe.mois)
                    return (
                      <Groupe
                        key={cle}
                        titre={titre}
                        nom={titre}
                        compte={compteTaches(groupe.taches.length)}
                        replie={replies.estReplie(cle)}
                        onBasculer={() => replies.basculer(cle)}
                      >
                        {lignesDuMois(groupe.taches)}
                      </Groupe>
                    )
                  })}
            </>
          )}
        </DeuxColonnes>
      )}
    </>
  )
}
