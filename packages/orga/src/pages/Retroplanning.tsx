import { useQuery } from '@apollo/client/react'
import {
  Card,
  Checkbox,
  Empty,
  Result,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import PastillePerimetre from '../composants/PastillePerimetre'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { RetroplanningQuery, TypePerimetre } from '../gql/graphql'
import { dateCourte } from '../lib/erreurs'
import { EDITION_COURANTE, EDITIONS } from '../lib/requetes'
import { grouperParMois, libelleMois } from '../lib/retroplanning'
import { STATUTS } from '../lib/taches'

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

type Tache = RetroplanningQuery['retroplanning'][number]
type FiltreType = 'tous' | TypePerimetre
type FiltreStatut = 'ouvertes' | 'toutes'

const ROUGE_RETARD = 'var(--rt-erreur)'
const PRIMAIRE = 'var(--rt-primaire)'

const estOuverte = (tache: Tache) =>
  tache.statut === 'A_FAIRE' || tache.statut === 'EN_COURS'

function titreGroupe(mois: string | null): string {
  if (mois === null) return 'Sans échéance'
  const libelle = libelleMois(mois)
  return libelle.charAt(0).toUpperCase() + libelle.slice(1)
}

export default function Retroplanning() {
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

  return (
    <>
      <Titre sousTitre="Les tâches de l’édition sont regroupées par mois, de la plus proche à la plus lointaine.">
        Rétroplanning
      </Titre>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Space>
          <span>Édition</span>
          <Select
            style={{ minWidth: 180 }}
            value={editionId}
            onChange={id => {
              setPerimetres([])
              setParametres({ edition: id })
            }}
            options={(editions?.editions ?? []).map(e => ({
              value: e.id,
              label: e.nom,
            }))}
          />
        </Space>
        <Select
          mode="multiple"
          maxTagCount="responsive"
          allowClear
          aria-label="Périmètres"
          placeholder="Tous les périmètres"
          style={{ flex: '1 1 260px', minWidth: 0 }}
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

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px 16px',
          marginBottom: 24,
        }}
      >
        <Segmented<FiltreType>
          aria-label="Type de périmètre"
          value={type}
          onChange={setType}
          options={[
            { value: 'tous', label: 'Tous' },
            { value: 'SPORT', label: 'Sports' },
            { value: 'POLE', label: 'Pôles' },
          ]}
        />
        <Segmented<FiltreStatut>
          aria-label="Statut des tâches"
          value={statut}
          onChange={setStatut}
          options={[
            { value: 'ouvertes', label: 'Ouvertes' },
            { value: 'toutes', label: 'Toutes' },
          ]}
        />
        <Checkbox
          checked={mesPerimetres}
          onChange={e => setMesPerimetres(e.target.checked)}
        >
          Mes périmètres
        </Checkbox>
        <Checkbox
          checked={assigneesAMoi}
          onChange={e => setAssigneesAMoi(e.target.checked)}
        >
          Assignées à moi
        </Checkbox>
      </div>

      {!data || !moi ? (
        <Skeleton active />
      ) : affectes.size === 0 &&
        (mesPerimetres || (!moi.estAdmin && toutes?.length === 0)) ? (
        <Card>
          <Empty description="Vous n’êtes affecté·e à aucun périmètre pour cette édition." />
        </Card>
      ) : taches.length === 0 ? (
        <Card>
          <Empty description="Aucune tâche ne correspond à ces filtres." />
        </Card>
      ) : (
        <>
          <Typography.Paragraph strong style={{ marginBottom: 16 }}>
            {taches.length} {taches.length > 1 ? 'tâches' : 'tâche'}, dont{' '}
            <span style={{ color: enRetard > 0 ? ROUGE_RETARD : undefined }}>
              {enRetard} en retard
            </span>
          </Typography.Paragraph>

          <Space orientation="vertical" size={24} style={{ width: '100%' }}>
            {groupes.map(groupe => (
              <section key={groupe.mois ?? 'sans-echeance'}>
                <Typography.Title level={4} style={{ marginTop: 0 }}>
                  {titreGroupe(groupe.mois)}
                </Typography.Title>
                <Card size="small" styles={{ body: { padding: 0 } }}>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {groupe.taches.map((tache, index) => (
                      <LigneTache
                        key={tache.id}
                        tache={tache}
                        moiId={moi.id}
                        editionId={editionId ?? ''}
                        premiere={index === 0}
                      />
                    ))}
                  </ul>
                </Card>
              </section>
            ))}
          </Space>
        </>
      )}
    </>
  )
}

function LigneTache({
  tache,
  moiId,
  editionId,
  premiere,
}: {
  tache: Tache
  moiId: string
  editionId: string
  premiere: boolean
}) {
  return (
    <li
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: '4px 16px',
        padding: '10px 12px',
        borderInlineStart: `4px solid ${tache.enRetard ? ROUGE_RETARD : 'transparent'}`,
        borderTop: premiere ? undefined : '1px solid var(--rt-encre-08)',
        opacity: tache.statut === 'ABANDONNEE' ? 0.6 : 1,
      }}
    >
      {tache.echeance && (
        <span style={{ flex: '0 0 130px', fontSize: 14 }}>
          {dateCourte(tache.echeance)}
        </span>
      )}
      {/* Le titre et les étiquettes partagent une colonne.
          Les étiquettes passent sous le titre quand la place manque. */}
      <div
        style={{
          flex: '1 1 240px',
          minWidth: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '6px 12px',
        }}
      >
        <Link
          to={`/perimetres/${tache.perimetre.slug}?edition=${editionId}`}
          style={{
            flex: '1 1 220px',
            minWidth: 0,
            fontWeight: 700,
            overflowWrap: 'anywhere',
            textDecoration:
              tache.statut === 'ABANDONNEE' ? 'line-through' : undefined,
          }}
        >
          {tache.titre}
        </Link>
        <Space size={[6, 6]} wrap style={{ minWidth: 0 }}>
          <Tag
            style={{
              borderInlineStart: `4px solid ${tache.perimetre.couleur ?? PRIMAIRE}`,
              marginInlineEnd: 0,
            }}
          >
            {tache.perimetre.nom}
          </Tag>
          <Tag
            color={STATUTS[tache.statut].couleur}
            style={{ marginInlineEnd: 0 }}
          >
            {STATUTS[tache.statut].libelle}
          </Tag>
          {tache.enRetard && (
            <Tag color="red" style={{ marginInlineEnd: 0 }}>
              En retard
            </Tag>
          )}
          {tache.assignes.length === 0 ? (
            estOuverte(tache) && (
              <Tag color="orange" style={{ marginInlineEnd: 0 }}>
                Personne
              </Tag>
            )
          ) : (
            <span style={{ fontSize: 14, overflowWrap: 'anywhere' }}>
              {tache.assignes
                .map(p => (p.id === moiId ? 'Vous' : p.nom))
                .join(', ')}
            </span>
          )}
        </Space>
      </div>
    </li>
  )
}
