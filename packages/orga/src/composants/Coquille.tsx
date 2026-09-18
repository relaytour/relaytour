import {
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  EditOutlined,
  FlagOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  ScheduleOutlined,
  SettingOutlined,
  SolutionOutlined,
  TrophyOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { colors, fonts } from '@relaytour/tokens'
import { Button, Drawer, Grid, Layout, Menu, Result, Spin } from 'antd'
import { useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'

import { seDeconnecter } from '../lib/connexion'

import Notifications from './Notifications'
import { graphql } from '../gql'
import { MOI } from '../lib/requetes'

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
        }
      }
    }
  }
`)

const { Header, Sider, Content } = Layout

// Mise en page des écrans connectés. Sans session, elle renvoie vers la connexion ;
// les écrans d'admin exigent en plus le droit d'admin.
export default function Coquille({
  adminSeulement = false,
}: {
  adminSeulement?: boolean
}) {
  const { data, loading, error } = useQuery(MOI)
  const { data: menu } = useQuery(MENU_PERIMETRES, { skip: !data?.moi })
  const apollo = useApolloClient()
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
              icon: <FlagOutlined />,
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

  const deconnecter = async () => {
    await seDeconnecter().catch(() => undefined)
    await apollo.clearStore()
    navigate('/connexion', { replace: true })
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingInline: ecrans.md ? 24 : 16,
        }}
      >
        {!ecrans.md && (
          <Button
            icon={<MenuOutlined />}
            aria-label="Ouvrir le menu"
            onClick={() => setTiroirOuvert(true)}
          />
        )}
        <span
          style={{
            fontFamily: fonts.display,
            fontSize: 30,
            color: colors.blanc,
            letterSpacing: '.04em',
            whiteSpace: 'nowrap',
          }}
        >
          Relay<span style={{ color: colors.corail }}>tour</span>
        </span>
        <span style={{ flex: 1 }} />
        {ecrans.sm && (
          <span style={{ color: colors.blanc, fontWeight: 600 }}>
            {moi.nom}
          </span>
        )}
        <Notifications compact={!ecrans.md} />
        <Button
          icon={<LogoutOutlined />}
          aria-label="Se déconnecter"
          onClick={() => void deconnecter()}
        >
          {ecrans.sm ? 'Se déconnecter' : null}
        </Button>
      </Header>
      <Layout>
        {ecrans.md ? (
          <Sider width={240} theme="light">
            <Menu
              mode="inline"
              selectedKeys={[
                pathname.startsWith('/fiches') ? '/fiches' : pathname,
              ]}
              items={entrees}
              onClick={({ key }) => {
                setTiroirOuvert(false)
                navigate(key)
              }}
              style={{ borderInlineEnd: 'none', paddingTop: 12 }}
            />
          </Sider>
        ) : (
          <Drawer
            placement="left"
            size={280}
            open={tiroirOuvert}
            onClose={() => setTiroirOuvert(false)}
            title="Menu"
            styles={{ body: { padding: 0 } }}
          >
            <Menu
              mode="inline"
              selectedKeys={[
                pathname.startsWith('/fiches') ? '/fiches' : pathname,
              ]}
              items={entrees}
              onClick={({ key }) => {
                setTiroirOuvert(false)
                navigate(key)
              }}
              style={{ borderInlineEnd: 'none', paddingTop: 12 }}
            />
          </Drawer>
        )}
        <Content
          style={{
            // Élément flex : sans min-width 0, un tableau large pousse la page hors de l'écran.
            minWidth: 0,
            padding: ecrans.md ? 32 : 16,
            maxWidth: 1100,
            width: '100%',
          }}
        >
          {adminSeulement && !moi.estAdmin ? (
            <Result status="403" title="Cette page est réservée aux admins." />
          ) : (
            <Outlet />
          )}
        </Content>
      </Layout>
    </Layout>
  )
}
