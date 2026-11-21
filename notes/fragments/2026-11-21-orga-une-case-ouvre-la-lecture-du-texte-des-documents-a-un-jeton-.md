---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.36.0
fr:
  titre: >-
    Une case ouvre la lecture du texte des documents à un jeton ou à une
    application
  texte: >-
    Dans les préférences, la création d'un jeton propose la case « Lire le
    texte des documents du fournisseur cloud », décochée par défaut. L'écran de
    consentement propose la même case quand une application demande cette
    lecture. Le programme lit alors le texte des documents que vous ouvrez déjà
    dans la liseuse. La liste « Applications autorisées », vos jetons et le
    panneau « API » de l'écran « Organisation » indiquent les accès qui portent
    cette lecture.
en:
  titre: >-
    A checkbox lets a token or an application read document text
  texte: >-
    In the preferences, creating a token offers the "Read the text of cloud
    provider documents" checkbox, unchecked by default. The consent screen
    offers the same checkbox when an application requests this access. The
    program then reads the text of the documents you already open in the
    viewer. The "Authorized applications" list, your tokens and the "API" panel
    of the "Organization" screen show which accesses include it.
---

ADR 0072. `PreferenceJetons.tsx` et `pages/Autoriser.tsx` portent la case
`lectureDocuments` ; `JetonsOrganisation.tsx` et `ApplicationsAutorisees.tsx`
affichent l'étiquette « Texte des documents ».
