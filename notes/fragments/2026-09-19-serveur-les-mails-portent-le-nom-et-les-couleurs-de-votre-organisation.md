---
cible: serveur
type: fonctionnalite
audience: staff
etat: prevu
fr:
  titre: >-
    Les mails portent le nom et les couleurs de votre organisation
  texte: >-
    L'en-tête, les sujets et le pied de chaque mail affichent le nom court
    de votre organisation. Le texte, les boutons et le fond reprennent les
    couleurs de son thème. Le pied garde un crédit « propulsé par Relaytour,
    logiciel libre ». Les mails n'appellent aucune police web.
---

- Couleurs sentinelles dans les `.mjml`, remplacées par `{{couleurEncre}}`,
  `{{couleurPrimaire}}`, `{{couleurAccent}}` et `{{couleurSol}}` après
  compilation (`scripts/gabarits-courriel.ts`).
- `rendre(nom, variables, organisation)` refuse une couleur qui n'a pas la
  forme `#RRGGBB` : la valeur entre dans un attribut `style`.
