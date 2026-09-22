---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Les postes à pourvoir s'affichent périmètre par périmètre
  texte: >-
    La page « Postes à pourvoir » place en premier les périmètres qui manquent
    de référentes et de référents. Vous modifiez l'effectif souhaité et affectez
    une personne sans changer de page. Le bouton « Copier l'appel » prépare un
    message qui liste les périmètres à pourvoir. La page des personnes gagne une
    recherche et un filtre.
---

- Page admin/Postes (remplace admin/Affectations, redirection conservée).
- Menu « Postes à pourvoir » avec l'icône SolutionOutlined.
- Page admin/Personnes : recherche sans accents ni casse, choix de l'édition,
  filtre « Sans affectation pour cette édition », colonne « Affectations ».
- `normaliser` déplacé dans `src/lib/recherche.ts`.
