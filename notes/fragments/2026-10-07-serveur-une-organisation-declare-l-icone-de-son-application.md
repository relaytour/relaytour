---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
version: 0.13.0
fr:
  titre: >-
    Une organisation déclare l'icône de son application
  texte: >-
    L'écran « Organisation » reçoit le champ « Icône d'application » : un PNG
    carré de 512 pixels de côté. Cette icône s'affiche sur l'écran d'accueil
    d'un téléphone qui installe l'espace organisateur. Sans elle, l'application
    porte l'icône de Relaytour. Le fichier `organisation.yaml` la déclare par le
    champ `iconeApplication`.
en:
  titre: >-
    An organization declares its app icon
  texte: >-
    The “Organization” screen gains an “App icon” field: a square PNG, 512
    pixels per side. This icon appears on the home screen of a phone that
    installs the organizer workspace. Without it, the app uses the Relaytour
    icon. The `organisation.yaml` file declares it in the `iconeApplication`
    field.
---

ADR 0023. Route `GET /medias/application/<slug>.webmanifest`, sans session,
limitée à l'identité publique. Champs `Organisation.manifestUrl` et
`iconeApplicationUrl`, argument `iconeApplication` de
`modifierIdentiteOrganisation`. L'import et la mutation vérifient les dimensions
dans l'en-tête du PNG : le serveur ne redimensionne aucune image.
