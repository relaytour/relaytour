import { BookOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Result,
  Segmented,
  Select,
  Skeleton,
  Space,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import Avancement from '../composants/Avancement'
import TacheCarte from '../composants/TacheCarte'
import TacheFormulaire from '../composants/TacheFormulaire'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { TacheChampsFragment } from '../gql/graphql'
import { EDITION_COURANTE, EDITIONS, MOI } from '../lib/requetes'

const PAGE = graphql(`
  query PagePerimetre($slug: String!, $editionId: ID!) {
    moi {
      id
    }
    perimetre(slug: $slug) {
      id
      nom
      type
      couleur
      peutModifier(editionId: $editionId)
      referents(editionId: $editionId) {
        id
        nom
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
      peutRedigerFiches
      fiches {
        id
        slug
        titre
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

type Filtre = 'ouvertes' | 'faites' | 'abandonnees' | 'toutes'

const FILTRES: Record<Filtre, (t: TacheChampsFragment) => boolean> = {
  ouvertes: t => t.statut === 'A_FAIRE' || t.statut === 'EN_COURS',
  faites: t => t.statut === 'FAITE',
  abandonnees: t => t.statut === 'ABANDONNEE',
  toutes: () => true,
}

export default function Perimetre() {
  const { slug = '' } = useParams()
  const [parametres, setParametres] = useSearchParams()
  const navigate = useNavigate()
  const { data: session } = useQuery(MOI)
  const { data: courante } = useQuery(EDITION_COURANTE)
  const { data: editions } = useQuery(EDITIONS)
  const editionId = parametres.get('edition') ?? courante?.editionCourante?.id
  const { data, loading, error } = useQuery(PAGE, {
    variables: { slug, editionId: editionId ?? '' },
    skip: editionId === undefined,
  })
  const [filtre, setFiltre] = useState<Filtre>('ouvertes')
  const [enEdition, setEnEdition] = useState<
    TacheChampsFragment | 'nouvelle' | null
  >(null)

  const perimetre = data?.perimetre
  const taches = useMemo(
    () => (perimetre?.taches ?? []).filter(FILTRES[filtre]),
    [perimetre, filtre]
  )

  if (error) {
    return <Result status="403" title="Vous n’avez pas accès à ce périmètre." />
  }
  if (editionId === undefined && courante && !courante.editionCourante) {
    return <Result status="info" title="Aucune édition n’est en préparation." />
  }
  if (loading || !data) return <Skeleton active />
  if (!perimetre || !data.moi)
    return <Result status="404" title="Ce périmètre est introuvable." />

  const edition = editions?.editions.find(e => e.id === editionId)

  return (
    <>
      <div
        style={{
          borderInlineStart: `8px solid ${perimetre.couleur ?? 'var(--rt-primaire)'}`,
          paddingInlineStart: 16,
        }}
      >
        <Titre
          sousTitre={
            perimetre.referents.length > 0
              ? `Référent·es : ${perimetre.referents.map(r => r.nom).join(', ')}`
              : 'Aucune personne n’est affectée à ce périmètre pour cette édition.'
          }
        >
          {perimetre.nom}
        </Titre>
      </div>

      <Space
        wrap
        style={{
          marginBottom: 16,
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <span>Édition</span>
          <Select
            style={{ minWidth: 180 }}
            value={editionId}
            onChange={id => setParametres({ edition: id })}
            options={(editions?.editions ?? []).map(e => ({
              value: e.id,
              label: e.nom,
            }))}
          />
        </Space>
        {perimetre.peutModifier && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setEnEdition('nouvelle')}
          >
            Nouvelle tâche
          </Button>
        )}
      </Space>

      {!perimetre.peutModifier && edition?.statut === 'ARCHIVEE' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Cette édition est archivée. Ses tâches sont consultables en lecture seule."
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Avancement avancement={perimetre.avancement} />
      </Card>

      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <BookOutlined />
            Fiches méthode
          </Space>
        }
        extra={
          perimetre.peutRedigerFiches && (
            <Button
              size="small"
              onClick={() => navigate(`/fiches/nouvelle?perimetre=${slug}`)}
            >
              Nouvelle fiche
            </Button>
          )
        }
      >
        {perimetre.fiches.length === 0 ? (
          <Typography.Text type="secondary">
            Aucune fiche pour ce périmètre.
          </Typography.Text>
        ) : (
          <Space size={[8, 8]} wrap>
            {perimetre.fiches.map(f => (
              <Link key={f.id} to={`/fiches/${f.slug}`}>
                <Button size="small" type="dashed">
                  {f.titre}
                </Button>
              </Link>
            ))}
          </Space>
        )}
      </Card>

      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <Segmented<Filtre>
          value={filtre}
          onChange={setFiltre}
          options={[
            {
              value: 'ouvertes',
              label: `Ouvertes (${perimetre.avancement.aFaire + perimetre.avancement.enCours})`,
            },
            {
              value: 'faites',
              label: `Faites (${perimetre.avancement.faites})`,
            },
            {
              value: 'abandonnees',
              label: `Abandonnées (${perimetre.avancement.abandonnees})`,
            },
            { value: 'toutes', label: 'Toutes' },
          ]}
        />
      </div>

      {taches.length === 0 ? (
        <Card>
          <Empty description="Aucune tâche dans cette catégorie." />
        </Card>
      ) : (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {taches.map(tache => (
            <TacheCarte
              key={tache.id}
              tache={tache}
              moiId={data.moi!.id}
              peutModifier={perimetre.peutModifier}
              referents={perimetre.referents}
              estAdmin={session?.moi?.estAdmin ?? false}
              onModifier={setEnEdition}
            />
          ))}
        </Space>
      )}

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
      <Typography.Paragraph
        type="secondary"
        style={{ marginTop: 24, fontSize: 13 }}
      >
        Les tâches sont triées par échéance. Une tâche ne se supprime pas : elle
        s’abandonne.
      </Typography.Paragraph>
    </>
  )
}
