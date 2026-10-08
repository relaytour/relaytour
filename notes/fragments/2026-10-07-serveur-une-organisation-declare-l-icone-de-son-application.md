---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    Une organisation déclare l'icône de son application
  texte: >-
    L'écran « Organisation » reçoit le champ « Icône d'application » : un PNG
    carré de 512 pixels de côté. Cette icône s'affiche sur l'écran d'accueil
    d'un téléphone qui installe l'espace organisateur. Sans elle, l'application
    porte l'icône de Relaytour. Le fichier `organisation.yaml` la déclare par le
    champ `iconeApplication`.
---

ADR 0023. Route `GET /medias/application/<slug>.webmanifest`, sans session,
limitée à l'identité publique. Champs `Organisation.manifestUrl` et
`iconeApplicationUrl`, argument `iconeApplication` de
`modifierIdentiteOrganisation`. L'import et la mutation vérifient les dimensions
dans l'en-tête du PNG : le serveur ne redimensionne aucune image.
