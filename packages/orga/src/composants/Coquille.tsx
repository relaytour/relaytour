import {
  CompassOutlined,
  ContactsOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  BankOutlined,
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  CloseOutlined,
  EditOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  ScheduleOutlined,
  SearchOutlined,
  SettingOutlined,
  SolutionOutlined,
  TrophyOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { Alert, Button, Drawer, Grid, Menu } from 'antd'
import { useCallback, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { useOuvertureDepuisNotification } from '../lib/application'
import { useRafraichissement } from '../lib/rafraichissement'
import { choisirOrganisation } from '../lib/selection'
import {
  ecrireVolet,
  etatDuVolet,
  LARGEUR_VOLET_DEPLIE,
  lireVolet,
  useLargeurAuMoins,
} from '../lib/volets'
import { ContexteSession, type Session } from '../lib/session'

import AvisMiseAJour from './AvisMiseAJour'
import AvisRelecture from './AvisRelecture'
import ChoixActivite from './ChoixActivite'
import FournisseurActivite from './FournisseurActivite'
import { AvisHorsConnexion } from './HorsConnexion'
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
  useRafraichissement(active.slug)
  const navigate = useNavigate()
  // Une notification push peut venir d'une autre organisation de la personne
  // (ADR 0024) : elle devient l'active, et le cache repart de zéro, avant l'écran.
  const apollo = useApolloClient()
  const ouvrirNotification = useCallback(
    (chemin: string, organisation: string | null) => {
      if (organisation === null || organisation === active.slug) {
        navigate(chemin)
        return
      }
      choisirOrganisation(organisation)
      void apollo.resetStore().finally(() => navigate(chemin))
    },
    [active.slug, apollo, navigate]
  )
  useOuvertureDepuisNotification(ouvrirNotification)
  const { pathname } = useLocation()
  const ecrans = Grid.useBreakpoint()
  // Sous 576 px, la recherche se replie en un bouton. Ouverte, elle occupe
  // seule la barre haute, et se referme quand l'écran change.
  const etroit = Boolean(ecrans.xs)
  const [rechercheOuverteSur, setRechercheOuverteSur] = useState<string>()
  const boutonRecherche = useRef<HTMLButtonElement>(null)
  const rechercheSeule = etroit && rechercheOuverteSur === pathname
  const setRechercheOuverte = (ouverte: boolean) =>
    setRechercheOuverteSur(ouverte ? pathname : undefined)
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
    // Deux niveaux d'administration, du plus proche au plus large : l'activité
    // affichée, ouverte à ses admins, puis l'organisation. La page de l'organisation
    // l'annuaire et l'écran
    // « Admins » reviennent aux admins de l'organisation seulement (ADR 0010, 0019).
    ...(gere
      ? [
          {
            type: 'group' as const,
            label: 'Gérer l’activité',
            children: [
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
          {
            type: 'group' as const,
            label: 'Gérer l’organisation',
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
              ...(moi.estAdmin
                ? [
                    {
                      key: lien('/admin/annuaire'),
                      icon: <ContactsOutlined />,
                      label: 'Annuaire',
                    },
                    {
                      key: lien('/admin/admins'),
                      icon: <SafetyCertificateOutlined />,
                      label: 'Admins',
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ]

  // Le volet de navigation (docs/design-system.md, « Volets ») : déplié, ou
  // réduit à un rail d'icônes collé au bord gauche. Le choix de la personne
  // l'emporte sur le défaut, qui suit la largeur de l'écran.
  const large = useLargeurAuMoins(LARGEUR_VOLET_DEPLIE)
  const [choixVolet, setChoixVolet] = useState(lireVolet)
  const rail = etatDuVolet(choixVolet, large) === 'rail'
  const basculerVolet = () => {
    const suivant = rail ? 'deplie' : 'rail'
    ecrireVolet(suivant)
    setChoixVolet(suivant)
  }

  const navigation = (replie: boolean) => (
    <Menu
      mode="inline"
      // En rail, Ant Design ne garde que les icônes et affiche le libellé dans
      // une bulle, au survol et au focus.
      inlineCollapsed={replie}
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

  return (
    <div className="rt-page">
      <div className="rt-halo rt-halo-1" aria-hidden="true" />
      <div className="rt-halo rt-halo-2" aria-hidden="true" />
      {ecrans.md ? (
        <nav
          className={
            rail
              ? 'rt-verre-barre rt-barre-laterale rt-rail'
              : 'rt-verre-barre rt-barre-laterale'
          }
          aria-label="Navigation principale"
        >
          <Button
            className="rt-bascule-volet"
            type="text"
            icon={rail ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            aria-label={rail ? 'Déplier le menu' : 'Replier le menu'}
            aria-expanded={!rail}
            title={rail ? 'Déplier le menu' : 'Replier le menu'}
            onClick={basculerVolet}
          />
          <ChoixActivite />
          {navigation(rail)}
          <SignatureRelaytour compacte={rail} />
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
          {navigation(false)}
          <SignatureRelaytour />
        </Drawer>
      )}
      <div className="rt-principal">
        <header className="rt-verre-barre rt-barre-haute">
          {rechercheSeule ? (
            <>
              <Recherche
                estAdmin={gere}
                large
                apresChoix={() => setRechercheOuverte(false)}
              />
              <Button
                type="text"
                icon={<CloseOutlined />}
                aria-label="Fermer la recherche"
                onClick={() => {
                  setRechercheOuverte(false)
                  // Le bouton fermé disparaît : le focus revient au bouton qui
                  // avait ouvert la recherche, pas au document.
                  requestAnimationFrame(() => boutonRecherche.current?.focus())
                }}
              />
            </>
          ) : (
            <>
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
              {!etroit && <Recherche estAdmin={gere} />}
              <span style={{ flex: 1 }} />
              {etroit && (
                <Button
                  type="text"
                  icon={<SearchOutlined />}
                  aria-label="Rechercher"
                  ref={boutonRecherche}
                  onClick={() => setRechercheOuverte(true)}
                />
              )}
              <Notifications />
              <MenuCompte nom={moi.nom} afficherNom={Boolean(ecrans.sm)} />
            </>
          )}
        </header>
        <main className="rt-contenu">
          <AvisMiseAJour />
          <AvisHorsConnexion />
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
