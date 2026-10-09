import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'

import Coquille from './composants/Coquille'
import ReserveAdmin from './composants/ReserveAdmin'
import ReserveEquipe from './composants/ReserveEquipe'
import { VersActivite } from './composants/FournisseurActivite'
import GardeSession from './composants/GardeSession'
import Activites from './pages/admin/Activites'
import Admins from './pages/admin/Admins'
import Classement from './pages/admin/Classement'
import Editions from './pages/admin/Editions'
import Equipe from './pages/admin/Equipe'
import Organisation from './pages/admin/Organisation'
import Personnes from './pages/admin/Personnes'
import Redaction from './pages/admin/Redaction'
import Connexion from './pages/Connexion'
import Fiche from './pages/Fiche'
import FicheEditeur from './pages/FicheEditeur'
import Fiches from './pages/Fiches'
import MonEspace from './pages/MonEspace'
import Perimetre from './pages/Perimetre'
import Preferences from './pages/Preferences'
import Rejoindre from './pages/Rejoindre'
import Retroplanning from './pages/Retroplanning'
import TousLesPerimetres from './pages/TousLesPerimetres'

// Les écrans d'une activité vivent sous /<slug de l'activité>/ (ADR 0008). Une
// adresse sans activité (l'accueil, une adresse d'avant, un lien de mail) mène à la
// même page de l'activité par défaut.
const versActivite = <GardeSession>{() => <VersActivite />}</GardeSession>

const routeur = createBrowserRouter([
  { path: '/connexion', element: <Connexion /> },
  // Formulaire public d'une activité (ADR 0015), lisible sans session.
  { path: '/rejoindre/:organisation/:activite', element: <Rejoindre /> },
  { path: '/', element: versActivite },
  {
    path: '/:activite',
    element: <Coquille />,
    children: [
      { path: 'perimetres', element: <TousLesPerimetres /> },
      { path: 'preferences', element: <Preferences /> },
      // Les écrans de l'équipe : une personne qui découvre l'activité (ADR 0012)
      // est menée à « Tous les périmètres ».
      {
        element: <ReserveEquipe />,
        children: [
          { index: true, element: <MonEspace /> },
          { path: 'retroplanning', element: <Retroplanning /> },
          { path: 'perimetres/:slug', element: <Perimetre /> },
          { path: 'fiches', element: <Fiches /> },
          { path: 'fiches/nouvelle', element: <FicheEditeur /> },
          { path: 'fiches/:slug', element: <Fiche /> },
          { path: 'fiches/:slug/modifier', element: <FicheEditeur /> },
        ],
      },
      {
        path: 'admin',
        element: <ReserveAdmin />,
        children: [
          { index: true, element: <Navigate to="equipe" replace /> },
          { path: 'activites', element: <Activites /> },
          // L'avancement est une vue de l'écran « Équipe ». L'ancienne adresse
          // reste valable pour les favoris.
          {
            path: 'avancement',
            element: <Navigate to="../equipe?vue=avancement" replace />,
          },
          { path: 'classement', element: <Classement /> },
          { path: 'editions', element: <Editions /> },
          {
            path: 'organisation',
            element: <ReserveAdmin organisation />,
            children: [{ index: true, element: <Organisation /> }],
          },
          // L'annuaire de l'organisation : le même écran que « Personnes », sur
          // tous les membres (ADR 0018).
          {
            path: 'annuaire',
            element: <ReserveAdmin organisation />,
            children: [{ index: true, element: <Personnes annuaire /> }],
          },
          {
            path: 'admins',
            element: <ReserveAdmin organisation />,
            children: [{ index: true, element: <Admins /> }],
          },
          { path: 'equipe', element: <Equipe /> },
          { path: 'personnes', element: <Personnes /> },
          // Anciennes adresses des pages réunies dans « Équipe », conservées pour
          // les favoris.
          ...['affectations', 'perimetres', 'postes'].map(path => ({
            path,
            element: <Navigate to="../equipe" replace />,
          })),
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
