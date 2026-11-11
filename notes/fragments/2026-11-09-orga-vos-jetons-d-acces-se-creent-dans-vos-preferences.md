---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Vos jetons d'accès se créent dans vos préférences
  texte: >-
    Le panneau « Jetons et API » de vos préférences crée un jeton d'accès pour un
    programme : un script, une ligne de commande ou un outil de gestion de projet.
    Le programme travaille alors en votre nom, avec vos droits. Vous choisissez la
    lecture seule ou l'écriture, les activités ouvertes et la durée, un an au
    plus. Le jeton ne s'affiche qu'une fois, et vous le révoquez à tout moment.
    Un admin de l'organisation active d'abord l'API dans l'écran « Organisation ».
en:
  titre: >-
    Your access tokens are created in your preferences
  texte: >-
    The "Tokens and API" panel of your preferences creates an access token for a
    program: a script, a command line or a project management tool. The program
    then works on your behalf, with your rights. You choose read only or write,
    the open activities and the lifetime, one year at most. The token is shown
    only once, and you revoke it at any time. An organization admin first turns
    on the API in the "Organization" screen.
---

ADR 0064. `composants/PreferenceJetons.tsx` porte le panneau des préférences,
`composants/ModuleApi.tsx` l'interrupteur de l'écran « Organisation » et
`lib/jetons.ts` la requête de l'état du module. Le menu du compte reçoit l'entrée
« Jetons et API », qui mène à l'ancre `#jetons` des préférences.
