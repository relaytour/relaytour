---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
version: 0.18.0
fr:
  titre: >-
    Le titre long d’un panneau ne déborde plus sur son bouton
  texte: >-
    Sur un téléphone, le titre long d’un panneau passe sur plusieurs lignes, et
    son bouton se place dessous. Le libellé du bouton reste entier, par exemple
    « Lier un dossier » dans l’écran « Espace de fichiers ».
en:
  titre: >-
    A long panel title no longer overflows its button
  texte: >-
    On a phone, a long panel title wraps onto several lines, and its button
    moves below. The button label stays complete, for example “Link a folder” in
    the “Cloud provider” screen.
---

`.rt-panneau-titre` passe en `flex-wrap: wrap`, et l'élément placé à côté du
titre ne rétrécit plus (`flex-shrink: 0`). Le composant `Panneau` sert tous
les panneaux de l'espace organisateur.
