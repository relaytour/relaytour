---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.29.0
fr:
  titre: >-
    Les tiroirs et le champ de recherche ont des bords nets
  texte: >-
    Les tiroirs n'affichent plus d'ombre carrée autour de leurs coins arrondis.
    Le champ de recherche de la barre haute n'affiche plus un second fond, plus
    anguleux, derrière son contour arrondi.
en:
  titre: >-
    Drawers and the search field have clean edges
  texte: >-
    Drawers no longer show a square shadow around their rounded corners. The
    search field of the top bar no longer shows a second, sharper background
    behind its rounded outline.
---

`global.css` retire l'ombre d'antd de `.ant-drawer-content-wrapper`, que le
verre de `.ant-drawer-section` remplace. Une saisie semi-automatique qui porte
son propre champ (`.ant-select-auto-complete:has(.ant-input-affix-wrapper)`) ne
peint plus sa racine, ni au survol ni au focus.
