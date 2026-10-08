---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.13.0
fr:
  titre: >-
    Le menu et le volet latéral se replient pour laisser la place au contenu
  texte: >-
    Un bouton, à côté du nom de l'organisation, réduit le menu à une colonne
    d'icônes collée au bord de l'écran. Votre navigateur retient ce choix. Dans
    les écrans à deux colonnes, la colonne de droite se replie aussi, et elle
    reste à l'écran pendant que vous faites défiler la page.
---

`lib/volets.ts` : état du volet de navigation (rail sous 1100 px par défaut),
volet latéral collant qui suit le sens du défilement (`useVoletCollant`).
`DeuxColonnes` porte le repli du volet latéral, qui ne se retient pas d'un écran
à l'autre. Section « Volets » du design system.
