import {
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  EditOutlined,
  HomeOutlined,
  MenuOutlined,
  ScheduleOutlined,
  SettingOutlined,
  SolutionOutlined,
  TrophyOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Button, Drawer, Grid, Menu, Result, Spin } from 'antd'
import { useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'

import { graphql } from '../gql'
import { MOI } from '../lib/requetes'

import Marque, { Pictogramme } from './Marque'
import MenuCompte from './MenuCompte'
import Notifications from './Notifications'
import Recherche from './Recherche'

const MENU_PERIMETRES = graphql(`
  query MenuPerimetres {
    moi {
      id
      affectations {
        id
        perimetre {
          id
          slug
          nom
          couleur
        }
      }
    }
  }
`)

// Mise en page des écrans connectés : une barre latérale et une barre haute en
// verre, détachées des bords, posées sur le sol du thème. Sans session, elle
// renvoie vers la connexion ; les écrans d'admin exigent en plus le droit d'admin.
export default function Coquille({
  adminSeulement = false,
}: {
  adminSeulement?: boolean
}) {
  const { data, loading, error } = useQuery(MOI)
  const { data: menu } = useQuery(MENU_PERIMETRES, { skip: !data?.moi })
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const ecrans = Grid.useBreakpoint()
  const [tiroirOuvert, setTiroirOuvert] = useState(false)

  if (loading) {
    return <Spin fullscreen description="Chargement" />
  }
  if (error) {
    return (
      <Result
        status="warning"
        title="L’espace organisateur ne répond pas."
        subTitle="Vérifiez votre connexion, puis rechargez la page."
      />
    )
  }
  const moi = data?.moi
  if (!moi) return <Navigate to="/connexion" replace />

  // Les périmètres où la personne a été affectée, toutes éditions confondues.
  const perimetres = [
    ...new Map(
      (menu?.moi?.affectations ?? []).map(a => [a.perimetre.id, a.perimetre])
    ).values(),
  ].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  const entrees = [
    { key: '/', icon: <HomeOutlined />, label: 'Mon espace' },
    {
      key: '/retroplanning',
      icon: <ScheduleOutlined />,
      label: 'Rétroplanning',
    },
    { key: '/fiches', icon: <BookOutlined />, label: 'Fiches' },
    { key: '/preferences', icon: <SettingOutlined />, label: 'Préférences' },
    ...(perimetres.length > 0
      ? [
          {
            type: 'group' as const,
            label: 'Mes périmètres',
            children: perimetres.map(p => ({
              key: `/perimetres/${p.slug}`,
              icon: (
                <span
                  className="rt-point"
                  style={{ background: p.couleur ?? 'var(--rt-primaire)' }}
                  aria-hidden="true"
                />
              ),
              label: p.nom,
            })),
          },
        ]
      : []),
    ...(moi.estAdmin
      ? [
          {
            type: 'group' as const,
            label: 'Administration',
            children: [
              {
                key: '/admin/avancement',
                icon: <BarChartOutlined />,
                label: 'Avancement',
              },
              {
                key: '/admin/classement',
                icon: <TrophyOutlined />,
                label: 'Classement',
              },
              {
                key: '/admin/editions',
                icon: <CalendarOutlined />,
                label: 'Éditions',
              },
              {
                key: '/admin/perimetres',
                icon: <AppstoreOutlined />,
                label: 'Périmètres',
              },
              {
                key: '/admin/personnes',
                icon: <TeamOutlined />,
                label: 'Personnes',
              },
              {
                key: '/admin/postes',
                icon: <SolutionOutlined />,
                label: 'Postes à pourvoir',
              },
              {
                key: '/admin/redaction',
                icon: <EditOutlined />,
                label: 'Rédaction',
              },
            ],
          },
        ]
      : []),
  ]

  const navigation = (
    <Menu
      mode="inline"
      selectedKeys={[pathname.startsWith('/fiches') ? '/fiches' : pathname]}
      items={entrees}
      onClick={({ key }) => {
        setTiroirOuvert(false)
        navigate(key)
      }}
    />
  )

  const pied = (
    <div className="rt-pied-marque">
      <span style={{ display: 'inline-flex', color: 'var(--rt-encre-40)' }}>
        <Pictogramme taille={14} monochrome />
      </span>
      Propulsé par Relaytour
    </div>
  )

  return (
    <div className="rt-page">
      <div className="rt-halo rt-halo-1" aria-hidden="true" />
      <div className="rt-halo rt-halo-2" aria-hidden="true" />
      {ecrans.md ? (
        <nav
          className="rt-verre-barre rt-barre-laterale"
          aria-label="Navigation principale"
        >
          <Marque />
          {navigation}
          {pied}
        </nav>
      ) : (
        <Drawer
          placement="left"
          size={280}
          open={tiroirOuvert}
          onClose={() => setTiroirOuvert(false)}
          title={<Marque taille={24} />}
          styles={{
            body: { padding: 12, display: 'flex', flexDirection: 'column' },
          }}
        >
          {navigation}
          {pied}
        </Drawer>
      )}
      <div className="rt-principal">
        <header className="rt-verre-barre rt-barre-haute">
          {!ecrans.md && (
            <Button
              icon={<MenuOutlined />}
              aria-label="Ouvrir le menu"
              onClick={() => setTiroirOuvert(true)}
            />
          )}
          {!ecrans.md && (
            <span style={{ display: 'inline-flex', marginInlineStart: 4 }}>
              <Pictogramme taille={24} />
            </span>
          )}
          <Recherche estAdmin={moi.estAdmin} />
          <span style={{ flex: 1 }} />
          <Notifications />
          <MenuCompte nom={moi.nom} afficherNom={Boolean(ecrans.sm)} />
        </header>
        <main className="rt-contenu">
          {adminSeulement && !moi.estAdmin ? (
            <Result status="403" title="Cette page est réservée aux admins." />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
