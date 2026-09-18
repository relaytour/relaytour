import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'

import Coquille from './composants/Coquille'
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

const routeur = createBrowserRouter([
  { path: '/connexion', element: <Connexion /> },
  {
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
    ],
  },
  {
    path: '/admin',
    element: <Coquille adminSeulement />,
    children: [
      { path: 'avancement', element: <AvancementGlobal /> },
      { path: 'classement', element: <Classement /> },
      { path: 'editions', element: <Editions /> },
      { path: 'perimetres', element: <Perimetres /> },
      { path: 'personnes', element: <Personnes /> },
      { path: 'postes', element: <Postes /> },
      // Ancienne adresse de la page, conservée pour les favoris.
      {
        path: 'affectations',
        element: <Navigate to="/admin/postes" replace />,
      },
      { path: 'redaction', element: <Redaction /> },
    ],
  },
  {
    path: '*',
    element: <Coquille />,
    children: [{ path: '*', element: <MonEspace /> }],
  },
])

export default function Application() {
  return <RouterProvider router={routeur} />
}
