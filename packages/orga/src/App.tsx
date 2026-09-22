import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'

import Coquille from './composants/Coquille'
import ReserveAdmin from './composants/ReserveAdmin'
import { VersActivite } from './composants/FournisseurActivite'
import GardeSession from './composants/GardeSession'
import Activites from './pages/admin/Activites'
import AvancementGlobal from './pages/admin/AvancementGlobal'
import Classement from './pages/admin/Classement'
import Editions from './pages/admin/Editions'
import Perimetres from './pages/admin/Perimetres'
import Personnes from './pages/admin/Personnes'
import Postes from './pages/admin/Postes'
import Redaction from './pages/admin/Redaction'
import Connexion from './pages/Connexion'
import Fiche from './pages/Fiche'
import FicheEditeur from './pages/FicheEditeur'
import Fiches from './pages/Fiches'
import MonEspace from './pages/MonEspace'
import Perimetre from './pages/Perimetre'
import Preferences from './pages/Preferences'
import Retroplanning from './pages/Retroplanning'

// Les écrans d'une activité vivent sous /<slug de l'activité>/ (ADR 0008). Une
// adresse sans activité (l'accueil, une adresse d'avant, un lien de mail) mène à la
// même page de l'activité par défaut.
const versActivite = <GardeSession>{() => <VersActivite />}</GardeSession>

const routeur = createBrowserRouter([
  { path: '/connexion', element: <Connexion /> },
  { path: '/', element: versActivite },
  {
    path: '/:activite',
    element: <Coquille />,
    children: [
      { index: true, element: <MonEspace /> },
      { path: 'retroplanning', element: <Retroplanning /> },
      { path: 'perimetres/:slug', element: <Perimetre /> },
      { path: 'preferences', element: <Preferences /> },
      { path: 'fiches', element: <Fiches /> },
      { path: 'fiches/nouvelle', element: <FicheEditeur /> },
      { path: 'fiches/:slug', element: <Fiche /> },
      { path: 'fiches/:slug/modifier', element: <FicheEditeur /> },
      {
        path: 'admin',
        element: <ReserveAdmin />,
        children: [
          { index: true, element: <Navigate to="avancement" replace /> },
          { path: 'activites', element: <Activites /> },
          { path: 'avancement', element: <AvancementGlobal /> },
          { path: 'classement', element: <Classement /> },
          { path: 'editions', element: <Editions /> },
          { path: 'perimetres', element: <Perimetres /> },
          { path: 'personnes', element: <Personnes /> },
          { path: 'postes', element: <Postes /> },
          // Ancienne adresse de la page, conservée pour les favoris.
          {
            path: 'affectations',
            element: <Navigate to="../postes" replace />,
          },
          { path: 'redaction', element: <Redaction /> },
        ],
      },
    ],
  },
  { path: '*', element: versActivite },
])

export default function Application() {
  return <RouterProvider router={routeur} />
}
