import {
  ApartmentOutlined,
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
import { Alert, Button, Drawer, Grid, Menu, Select } from 'antd'
import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { ContexteSession, type Session } from '../lib/session'

import FournisseurActivite from './FournisseurActivite'
import GardeSession from './GardeSession'
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
          activite {
            id
          }
        }
      }
    }
  }
`)

// Mise en page des écrans connectés : une barre latérale et une barre haute en
// verre, détachées des bords, posées sur le sol du thème. La garde de session
// renvoie vers la connexion ou fait choisir l'organisation ; le fournisseur
// d'activité lit l'activité de l'adresse (ADR 0008).
export default function Coquille() {
  return (
    <GardeSession>
      {session => (
        <ContexteSession.Provider value={session}>
          <FournisseurActivite>
            <Mise session={session} />
          </FournisseurActivite>
        </ContexteSession.Provider>
      )}
    </GardeSession>
  )
}

function Mise({ session }: { session: Session }) {
  const { moi, active } = session
  const { activite, activites, lien, periode } = useActivite()
  const { data: menu } = useQuery(MENU_PERIMETRES)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const ecrans = Grid.useBreakpoint()
  const [tiroirOuvert, setTiroirOuvert] = useState(false)

  // Les périmètres de l'activité où la personne a été affectée, toutes périodes
  // confondues.
  const perimetres = [
    ...new Map(
      (menu?.moi?.affectations ?? [])
        .filter(a => a.perimetre.activite.id === activite.id)
        .map(a => [a.perimetre.id, a.perimetre])
    ).values(),
  ].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  const entrees = [
    { key: lien('/'), icon: <HomeOutlined />, label: 'Mon espace' },
    {
      key: lien('/retroplanning'),
      icon: <ScheduleOutlined />,
      label: 'Rétroplanning',
    },
    { key: lien('/fiches'), icon: <BookOutlined />, label: 'Fiches' },
    {
      key: lien('/preferences'),
      icon: <SettingOutlined />,
      label: 'Préférences',
    },
    ...(perimetres.length > 0
      ? [
          {
            type: 'group' as const,
            label: 'Mes périmètres',
            children: perimetres.map(p => ({
              key: lien(`/perimetres/${p.slug}`),
              icon: (
                <span className="rt-icone-point" aria-hidden="true">
                  <span
                    className="rt-point"
                    style={{ background: p.couleur ?? 'var(--rt-primaire)' }}
                  />
                </span>
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
                key: lien('/admin/activites'),
                icon: <ApartmentOutlined />,
                label: 'Activités',
              },
              {
                key: lien('/admin/avancement'),
                icon: <BarChartOutlined />,
                label: 'Avancement',
              },
              {
                key: lien('/admin/classement'),
                icon: <TrophyOutlined />,
                label: 'Classement',
              },
              {
                key: lien('/admin/editions'),
                icon: <CalendarOutlined />,
                label: periode.Pluriel,
              },
              {
                key: lien('/admin/perimetres'),
                icon: <AppstoreOutlined />,
                label: 'Périmètres',
              },
              {
                key: lien('/admin/personnes'),
                icon: <TeamOutlined />,
                label: 'Personnes',
              },
              {
                key: lien('/admin/postes'),
                icon: <SolutionOutlined />,
                label: 'Postes à pourvoir',
              },
              {
                key: lien('/admin/redaction'),
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
      selectedKeys={[
        pathname.startsWith(lien('/fiches')) ? lien('/fiches') : pathname,
      ]}
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
          {activites.length > 1 && (
            <Select
              aria-label="Activité"
              value={activite.slug}
              style={{ minWidth: 180 }}
              onChange={slug => navigate(`/${slug}/`)}
              options={activites.map(a => ({ value: a.slug, label: a.nom }))}
            />
          )}
          <Recherche estAdmin={moi.estAdmin} />
          <span style={{ flex: 1 }} />
          <Notifications />
          <MenuCompte nom={moi.nom} afficherNom={Boolean(ecrans.sm)} />
        </header>
        <main className="rt-contenu">
          {active.statut === 'LECTURE_SEULE' && (
            <Alert
              type="warning"
              showIcon
              title="Cette organisation est en lecture seule : vous pouvez consulter et exporter ses données, pas les modifier."
              style={{ marginBottom: 16 }}
            />
          )}
          {activite.archive && (
            <Alert
              type="info"
              showIcon
              title="Cette activité est archivée : elle reste consultable."
              style={{ marginBottom: 16 }}
            />
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
