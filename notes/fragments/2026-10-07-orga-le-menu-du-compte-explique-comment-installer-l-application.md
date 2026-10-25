---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.13.0
fr:
  titre: >-
    Le menu du compte explique comment installer l'application
  texte: >-
    Le menu du compte reçoit l'entrée « Installer l'application ». La fenêtre
    affiche les étapes de votre appareil : iPhone, Android ou ordinateur. Quand
    le navigateur le permet, un bouton installe l'application en un appui. Un
    mode d'emploi public décrit les mêmes étapes.
en:
  titre: >-
    The account menu explains how to install the app
  texte: >-
    The account menu has a new “Install the app” entry. The window shows the
    steps for your device: iPhone, Android, or computer. When the browser allows
    it, a button installs the app with one tap. A public user guide describes
    the same steps.
---

Lot 5 de l'ADR 0023. `InstallerApplication`, `lib/installation.ts`
(`beforeinstallprompt`, détection de l'appareil), page
`site/modes-d-emploi/installer.html`. L'entrée est masquée dans l'application
déjà installée. Le bouton de partage du lien « Rejoindre », prévu au plan, est
écarté : aucun écran ne présente ce lien seul.
