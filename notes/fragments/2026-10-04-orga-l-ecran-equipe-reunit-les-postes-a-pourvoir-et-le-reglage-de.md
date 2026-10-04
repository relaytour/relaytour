---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    L'écran Équipe réunit les postes à pourvoir et le réglage des périmètres
  texte: >-
    Dans l'administration, « Postes à pourvoir » devient « Équipe ». Chaque
    carte de périmètre garde son effectif, ses personnes affectées et ses
    souhaits. Sa roue dentée ouvre le réglage du périmètre : nom, groupe,
    description, couleur, ordre et archivage. Le bouton « Nouveau périmètre »
    et la liste « Périmètres archivés » se trouvent sur le même écran. La page
    « Périmètres » quitte le menu, et vos anciens favoris mènent à « Équipe ».
---

`pages/admin/Postes.tsx` devient `pages/admin/Equipe.tsx`. Le formulaire et les
mutations de `pages/admin/Perimetres.tsx` passent dans
`composants/ReglagePerimetre.tsx`, et la page est supprimée. `modifierPerimetre`
renvoie les champs réglés, pour que le cache mette à jour le périmètre partout.
Les routes `admin/postes`, `admin/perimetres` et `admin/affectations` redirigent
vers `admin/equipe`. Le serveur ne change pas.
