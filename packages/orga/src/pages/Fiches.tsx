import { PlusOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Button, Card, Empty, Input, Skeleton, Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import Titre from '../composants/Titre'
import type { ListeFichesQuery } from '../gql/graphql'
import { LISTE_FICHES } from '../lib/fiches'
import { normaliser } from '../lib/recherche'

type FicheListe = ListeFichesQuery['fiches'][number]

export default function Fiches() {
  const navigate = useNavigate()
  const { data, loading } = useQuery(LISTE_FICHES)
  const [recherche, setRecherche] = useState('')

  const groupes = useMemo(() => {
    const filtre = normaliser(recherche.trim())
    const map = new Map<
      string,
      { nom: string; slug: string | null; fiches: FicheListe[] }
    >()
    for (const fiche of data?.fiches ?? []) {
      if (filtre && !normaliser(fiche.titre).includes(filtre)) continue
      const cle = fiche.perimetre?.id ?? 'communes'
      const groupe = map.get(cle) ?? {
        nom: fiche.perimetre?.nom ?? 'Fiches communes',
        slug: fiche.perimetre?.slug ?? null,
        fiches: [],
      }
      groupe.fiches.push(fiche)
      map.set(cle, groupe)
    }
    return [...map.values()].sort((a, b) =>
      a.slug === null
        ? -1
        : b.slug === null
          ? 1
          : a.nom.localeCompare(b.nom, 'fr')
    )
  }, [data, recherche])

  return (
    <>
      <Titre sousTitre="Les fiches méthode expliquent comment mener chaque étape de l’organisation.">
        Fiches
      </Titre>
      <Space
        wrap
        style={{
          marginBottom: 16,
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <Input.Search
          allowClear
          placeholder="Rechercher une fiche"
          style={{ maxWidth: 320 }}
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
        />
        {data?.peutRedigerFichesCommunes && (
          <Button
            icon={<PlusOutlined />}
            onClick={() => navigate('/fiches/nouvelle')}
          >
            Nouvelle fiche commune
          </Button>
        )}
      </Space>

      {loading ? (
        <Skeleton active />
      ) : groupes.length === 0 ? (
        <Card>
          <Empty
            description={
              recherche
                ? 'Aucune fiche ne correspond.'
                : 'Aucune fiche pour le moment.'
            }
          />
        </Card>
      ) : (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          {groupes.map(groupe => (
            <Card
              key={groupe.slug ?? 'communes'}
              size="small"
              title={
                groupe.slug ? (
                  <Link to={`/perimetres/${groupe.slug}`}>{groupe.nom}</Link>
                ) : (
                  groupe.nom
                )
              }
            >
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {groupe.fiches.map(fiche => (
                  <li key={fiche.id} style={{ padding: '8px 0' }}>
                    <Link to={`/fiches/${fiche.slug}`}>
                      <Typography.Text strong>{fiche.titre}</Typography.Text>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </Space>
      )}
    </>
  )
}
