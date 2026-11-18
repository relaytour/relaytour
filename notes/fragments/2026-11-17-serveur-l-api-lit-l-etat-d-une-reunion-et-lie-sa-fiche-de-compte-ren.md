---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.32.0
fr:
  titre: >-
    L'API lit l'état d'une réunion et lie sa fiche de compte rendu
  texte: >-
    Le champ `etat` d'une réunion vaut `PREVUE`, `TERMINEE` ou `ANNULEE`. Le
    serveur le déduit de la fin de la réunion, et le champ `statut` ne change
    pas. Une réunion terminée refuse `modifierReunion` et `annulerReunion`. La
    mutation `lierCompteRenduReunion` lie une fiche de compte rendu, que le
    champ `compteRendu` relit.
---

ADR 0066. Migration additive `20261117120000_compte_rendu_reunion` (colonne
`Reunion.compteRenduFicheId`). L'export complet donne le compte rendu par
l'identifiant de contenu de la fiche.
