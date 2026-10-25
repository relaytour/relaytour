---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.13.0
fr:
  titre: >-
    L'espace organisateur s'installe sur l'écran d'accueil d'un téléphone
  texte: >-
    L'espace organisateur s'ajoute à l'écran d'accueil d'un téléphone, sous le
    nom et l'icône de votre organisation. Il s'ouvre alors sans barre d'adresse.
    Sans réseau, il affiche un écran « Hors connexion » et reprend au retour du
    réseau. Un avis annonce une nouvelle version : vous rechargez quand vous
    le voulez.
en:
  titre: >-
    The organizer workspace can be installed on a phone’s home screen
  texte: >-
    The organizer workspace can be added to a phone’s home screen, under your
    organization’s name and icon. It then opens without an address bar. Without
    a network, it shows an “Offline” screen and resumes when the network
    returns. A notice announces a new version, and you reload when you choose.
---

ADR 0023. Service worker `src/sw.ts`, construit en `/sw.js` par un plugin de
`vite.config.ts`, sans dépendance. Il garde la coquille en cache et n'intercepte
ni `/graphql`, ni `/api/`, ni `/medias/`. `OrganisationProvider` pose le manifest,
l'icône d'écran d'accueil et la couleur du thème. L'adresse d'ouverture
`/?organisation=<slug>` désigne l'organisation.
