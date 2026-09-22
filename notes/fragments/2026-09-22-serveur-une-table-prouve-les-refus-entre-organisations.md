---
cible: serveur
type: securite
audience: interne
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Une table prouve les refus entre organisations
  texte: >-
    Chaque requête et chaque mutation qui reçoit un identifiant est éprouvée
    avec les identifiants d'une autre organisation : elle refuse, et aucune
    donnée ne change. Un garde-fou exige qu'une opération nouvelle entre dans
    la table.
---

- `refus-croises.integration.test.ts` : 47 cas, empreinte des données de
  l'autre organisation avant et après chaque cas, couverture comparée au
  contrat.
- ADR 0008 : section « Revue de sécurité » et limites connues.
