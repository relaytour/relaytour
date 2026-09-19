---
cible: orga
type: correctif
audience: staff
etat: prevu
fr:
  titre: >-
    Les fenêtres et les listes s'affichent en verre blanc dépoli
  texte: >-
    Les fenêtres modales, les tiroirs, les listes déroulantes, les menus, les
    bulles et les messages s'affichent sur un verre blanc presque opaque et
    très flou. Le contenu de la page ne gêne plus la lecture. Le voile sous
    une fenêtre floute la page au lieu de l'assombrir.
---

- `--rt-verre-depoli` et `--rt-flou-depoli` dans `global.css`.
- En antd 6.6, le conteneur de la fenêtre modale s'appelle
  `.ant-modal-container` : l'ancienne règle visait `.ant-modal-content`, qui
  n'existe plus, et laissait la fenêtre transparente.
