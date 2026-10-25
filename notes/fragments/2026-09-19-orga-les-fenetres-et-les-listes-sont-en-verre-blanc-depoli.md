---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Les fenêtres et les listes s'affichent en verre blanc dépoli
  texte: >-
    Les fenêtres modales, les tiroirs, les listes déroulantes, les menus, les
    bulles et les messages s'affichent sur un verre blanc presque opaque et
    très flou. Le contenu de la page ne gêne plus la lecture. Le voile sous
    une fenêtre floute la page au lieu de l'assombrir.
en:
  titre: >-
    Windows and lists appear in frosted white glass
  texte: >-
    Modal windows, drawers, dropdown lists, menus, tooltips, and messages appear
    on an almost opaque, heavily blurred white glass. The page content no longer
    interferes with reading. The overlay behind a window blurs the page instead
    of darkening it.
---

- `--rt-verre-depoli` et `--rt-flou-depoli` dans `global.css`.
- En antd 6.6, le conteneur de la fenêtre modale s'appelle
  `.ant-modal-container` : l'ancienne règle visait `.ant-modal-content`, qui
  n'existe plus, et laissait la fenêtre transparente.
