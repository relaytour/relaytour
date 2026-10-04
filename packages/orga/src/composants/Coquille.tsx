import {
  CompassOutlined,
  ApartmentOutlined,
  BankOutlined,
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
import { Alert, Button, Drawer, Grid, Menu } from 'antd'
import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { useRafraichissement } from '../lib/rafraichissement'
import { ContexteSession, type Session } from '../lib/session'

import AvisRelecture from './AvisRelecture'
import ChoixActivite from './ChoixActivite'
import FournisseurActivite from './FournisseurActivite'
import GardeSession from './GardeSession'
import { Pictogramme, SignatureRelaytour } from './Marque'
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
  const { activite, lien, periode, gere, decouverte } = useActivite()
  const { data: menu } = useQuery(MENU_PERIMETRES)
  useRafraichissement()
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

  // Une personne qui découvre l'activité (ADR 0012) ne voit que « Tous les
  // périmètres » et ses préférences.
  const entrees = [
    ...(decouverte
      ? []
      : [
          { key: lien('/'), icon: <HomeOutlined />, label: 'Mon espace' },
          {
            key: lien('/retroplanning'),
            icon: <ScheduleOutlined />,
            label: 'Rétroplanning',
          },
          { key: lien('/fiches'), icon: <BookOutlined />, label: 'Fiches' },
        ]),
    {
      key: lien('/preferences'),
      icon: <SettingOutlined />,
      label: 'Préférences',
    },
    {
      type: 'group' as const,
      label: 'Périmètres',
      children: [
        {
          key: lien('/perimetres'),
          icon: <CompassOutlined />,
          label: 'Tous les périmètres',
        },
        ...perimetres.map(p => ({
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
      ],
    },
    // L'administration d'une activité s'ouvre à ses admins ; la page de
    // l'organisation, aux admins de l'organisation seulement (ADR 0010).
    ...(gere
      ? [
          {
            type: 'group' as const,
            label: 'Administration',
            children: [
              ...(moi.estAdmin
                ? [
                    {
                      key: lien('/admin/organisation'),
                      icon: <BankOutlined />,
                      label: 'Organisation',
                    },
                  ]
                : []),
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
                key: lien('/admin/equipe'),
                icon: <SolutionOutlined />,
                label: 'Équipe',
              },
              {
                key: lien('/admin/personnes'),
                icon: <TeamOutlined />,
                label: 'Personnes',
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
        pathname.startsWith(lien('/fiches'))
          ? lien('/fiches')
          : // Un périmètre hors du menu s'ouvre depuis « Tous les périmètres ».
            pathname.startsWith(lien('/perimetres/')) &&
              !perimetres.some(p => lien(`/perimetres/${p.slug}`) === pathname)
            ? lien('/perimetres')
            : pathname,
      ]}
      items={entrees}
      onClick={({ key }) => {
        setTiroirOuvert(false)
        navigate(key)
      }}
    />
  )

  const pied = <SignatureRelaytour />

  return (
    <div className="rt-page">
      <div className="rt-halo rt-halo-1" aria-hidden="true" />
      <div className="rt-halo rt-halo-2" aria-hidden="true" />
      {ecrans.md ? (
        <nav
          className="rt-verre-barre rt-barre-laterale"
          aria-label="Navigation principale"
        >
          <ChoixActivite />
          {navigation}
          {pied}
        </nav>
      ) : (
        <Drawer
          placement="left"
          size={280}
          open={tiroirOuvert}
          onClose={() => setTiroirOuvert(false)}
          title={
            <ChoixActivite
              taille={24}
              apresChoix={() => setTiroirOuvert(false)}
            />
          }
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
          <Recherche estAdmin={gere} />
          <span style={{ flex: 1 }} />
          <Notifications />
          <MenuCompte nom={moi.nom} afficherNom={Boolean(ecrans.sm)} />
        </header>
        <main className="rt-contenu">
          <AvisRelecture />
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
