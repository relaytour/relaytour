---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Les admins voient et révoquent les jetons d'accès de l'organisation
  texte: >-
    Dans l'écran « Organisation », le panneau « API pour les programmes tiers »
    liste les jetons d'accès de tous les membres et des robots, avec leur portée
    et leur dernier usage, et permet de révoquer chacun. Dans les préférences, la
    case « Ce jeton peut inviter, retirer et promouvoir des membres » s'ajoute à
    la création d'un jeton, décochée par défaut, et le bouton « Révoquer tous
    mes jetons » coupe tous les accès d'un geste.
en:
  titre: >-
    Admins see and revoke the organization's access tokens
  texte: >-
    In the "Organization" screen, the "API for third-party programs" panel lists
    the access tokens of every member and robot, with their scope and last use,
    and lets you revoke each one. In the preferences, the "This token can
    invite, remove and promote members" checkbox is added when creating a
    token, unchecked by default, and the "Revoke all my tokens" button cuts
    every access at once.
---

`composants/JetonsOrganisation.tsx` sous `ModuleApi` ; `PreferenceJetons.tsx` porte la
case `gestionMembres`, l'étiquette sur chaque jeton et `revoquerMesJetonsAcces`.
