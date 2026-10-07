---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Les tableaux se trient, se filtrent et leurs colonnes se redimensionnent
  texte: >-
    Vous triez un tableau par un clic sur l'en-tête d'une colonne, et vous le
    filtrez par l'icône de cet en-tête. Vous ajustez la largeur d'une colonne en
    faisant glisser son bord droit ; un double-clic rétablit la largeur
    automatique. Un clic sur une ligne des tableaux Personnes, Périodes et
    Activités ouvre sa fiche, comme le bouton placé au début de la ligne.
---

Composant commun `packages/orga/src/composants/Tableau.tsx`, utilisé par les six
tableaux de l'espace organisateur (personnes, demandes, activités, périodes,
classement, droits de rédaction). Les largeurs choisies restent dans le
navigateur (`localStorage`, clé `relaytour.tableau.<id>.largeurs`). Le tri et les
filtres portent sur les lignes déjà chargées.
