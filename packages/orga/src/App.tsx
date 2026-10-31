import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'

import Coquille from './composants/Coquille'
import ReserveAdmin from './composants/ReserveAdmin'
import ReserveEquipe from './composants/ReserveEquipe'
import ReserveModule from './composants/ReserveModule'
import { VersActivite } from './composants/FournisseurActivite'
import GardeSession from './composants/GardeSession'
import Activites from './pages/admin/Activites'
import Admins from './pages/admin/Admins'
import Classement from './pages/admin/Classement'
import Editions from './pages/admin/Editions'
import Equipe from './pages/admin/Equipe'
import ImportEquipe from './pages/admin/ImportEquipe'
import ImportTaches from './pages/admin/ImportTaches'
import EspaceFichiers from './pages/admin/EspaceFichiers'
import Organisation from './pages/admin/Organisation'
import MessagesActivite from './pages/admin/MessagesActivite'
import NotificationsAdmin from './pages/admin/NotificationsAdmin'
import Personnes from './pages/admin/Personnes'
import Redaction from './pages/admin/Redaction'
import Agenda from './pages/Agenda'
import AideMarkdown from './pages/AideMarkdown'
import AppelBenevoles from './pages/AppelBenevoles'
import Benevoles from './pages/Benevoles'
import ImportBenevoles from './pages/ImportBenevoles'
import Connexion from './pages/Connexion'
import EspaceBenevole from './pages/EspaceBenevole'
import Fiche from './pages/Fiche'
import FicheEditeur from './pages/FicheEditeur'
import Fiches from './pages/Fiches'
import MonEspace from './pages/MonEspace'
import Organigramme from './pages/Organigramme'
import Perimetre from './pages/Perimetre'
import Programme from './pages/Programme'
import Preferences from './pages/Preferences'
import Rejoindre from './pages/Rejoindre'
import Retroplanning from './pages/Retroplanning'
import Charge from './pages/Charge'
import TousLesPerimetres from './pages/TousLesPerimetres'

// Les écrans d'une activité vivent sous /<slug de l'activité>/ (ADR 0008). Une
// adresse sans activité (l'accueil, une adresse d'avant, un lien de mail) mène à la
// même page de l'activité par défaut.
const versActivite = <GardeSession>{() => <VersActivite />}</GardeSession>

const routeur = createBrowserRouter([
  { path: '/connexion', element: <Connexion /> },
  // Formulaire public d'une activité (ADR 0015), lisible sans session.
  { path: '/rejoindre/:organisation/:activite', element: <Rejoindre /> },
  // Page publique d'un appel à bénévoles et espace bénévole (ADR 0041), lisibles
  // sans session.
  { path: '/benevoles/:jeton', element: <AppelBenevoles /> },
  { path: '/benevole/:jeton', element: <EspaceBenevole /> },
  { path: '/', element: versActivite },
  {
    path: '/:activite',
    element: <Coquille />,
    children: [
      { path: 'perimetres', element: <TousLesPerimetres /> },
      // L'organigramme se lit aussi en découverte (ADR 0036).
      { path: 'organigramme', element: <Organigramme /> },
      { path: 'preferences', element: <Preferences /> },
      // Les écrans de l'équipe : une personne qui découvre l'activité (ADR 0012)
      // est menée à « Tous les périmètres ».
      {
        element: <ReserveEquipe />,
        children: [
          { index: true, element: <MonEspace /> },
          { path: 'retroplanning', element: <Retroplanning /> },
          // La charge de l'équipe se lit par toute l'équipe qui voit les tâches (ADR 0055).
          { path: 'charge', element: <Charge /> },
          // Un module inactif mène à « Mon espace » (ADR 0052).
          {
            element: <ReserveModule module="AGENDA" />,
            children: [{ path: 'agenda', element: <Agenda /> }],
          },
          { path: 'programme', element: <Programme /> },
          {
            element: <ReserveModule module="BENEVOLES" />,
            children: [
              { path: 'benevoles', element: <Benevoles /> },
              { path: 'benevoles/import', element: <ImportBenevoles /> },
            ],
          },
          { path: 'perimetres/:slug', element: <Perimetre /> },
          { path: 'fiches', element: <Fiches /> },
          { path: 'fiches/nouvelle', element: <FicheEditeur /> },
          { path: 'fiches/:slug', element: <Fiche /> },
          { path: 'fiches/:slug/modifier', element: <FicheEditeur /> },
          { path: 'aide/markdown', element: <AideMarkdown /> },
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
          { path: 'import/equipe', element: <ImportEquipe /> },
          { path: 'import/taches', element: <ImportTaches /> },
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
          // L'espace de fichiers de l'organisation (ADR 0038).
          {
            path: 'espace-fichiers',
            element: <ReserveAdmin organisation />,
            children: [{ index: true, element: <EspaceFichiers /> }],
          },
          { path: 'equipe', element: <Equipe /> },
          { path: 'messages', element: <MessagesActivite /> },
          // Les notifications d'admin, à part de la cloche (ADR 0033).
          { path: 'notifications', element: <NotificationsAdmin /> },
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
