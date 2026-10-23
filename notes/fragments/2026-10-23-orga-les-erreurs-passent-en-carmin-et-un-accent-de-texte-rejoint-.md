---
cible: orga
type: fonctionnalite
audience: public
etat: prevu
version: 0.21.0
fr:
  titre: >-
    Les erreurs passent en carmin, et un accent de texte rejoint le thème
  texte: >-
    Le thème par défaut affiche les erreurs et les retards en carmin. Ils ne se
    confondent plus avec l'accent terre cuite. L'accent colore désormais des
    surfaces et des traits, jamais un texte. Un texte qui reprend l'accent
    s'écrit dans un brun plus sombre, comme « tour » dans le logotype. Une
    organisation peut déclarer cet accent de texte (`accentTexte`) dans son
    thème. Sans déclaration, Relaytour le dérive de son accent.
---

Sous le frontmatter : le détail technique, jamais compilé.

Erreur `#B0283F` et erreur claire `#F9E1E5`, accent de texte `#7E3A24` dans le
thème par défaut. `accentTexteDerive` mêle l'accent d'un tiers d'encre ; le
thème « encre-lagon » et tout thème qui déclare son accent sans accent de texte
le reçoivent ainsi. Une activité qui change son accent perd l'accent de texte
de son organisation et reçoit celui de son propre accent. Le champ est
facultatif dans `organisation.yaml` et exposé par le type `CouleursTheme`.
`verifierAccessibilite` contrôle aussi l'accent de texte, et un test vérifie
que l'erreur et l'accent ont des teintes distinctes.
