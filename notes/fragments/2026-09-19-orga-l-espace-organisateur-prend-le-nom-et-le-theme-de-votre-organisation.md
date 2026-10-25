---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    L'espace organisateur prend le nom et le thème de votre organisation
  texte: >-
    La barre latérale, l'écran de connexion et le titre de l'onglet affichent
    le nom court de votre organisation, et son logo si elle en fournit un.
    Ses couleurs et ses polices s'appliquent dès la réponse de l'API. Un
    seul build de l'espace organisateur sert toutes les installations.
en:
  titre: >-
    The organizer workspace takes your organization’s name and theme
  texte: >-
    The sidebar, the sign-in screen, and the tab title show your organization’s
    short name, and its logo if it provides one. Its colors and fonts apply as
    soon as the API responds. A single build of the organizer workspace serves
    all installations.
---

- `src/lib/organisation.tsx` : requête publique `organisation`, contexte
  `useOrganisation()`, `OrganisationProvider` qui applique le thème et
  construit la configuration Ant Design.
- `Marque.tsx` lit le nom court et le logo dans le contexte.
