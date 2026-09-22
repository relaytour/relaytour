---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
version: 0.4.0
fr:
  titre: >-
    L'API sert le choix d'organisation et d'activité de l'espace organisateur
  texte: >-
    L'API liste les organisations de la personne connectée, suit l'activité
    désignée par un en-tête et range un périmètre dans un groupe de son
    activité. Les liens des mails portent l'activité, et le résumé parle des
    nouvelles de vos périmètres.
---

- Scope `authentifie` et requête `mesOrganisations`.
- En-tête `X-Relaytour-Activite` : activité par défaut de `exigerActivite()`.
- `organisation(slug)` sans session ; identité neutre sur une installation à
  plusieurs organisations.
- `creerPerimetre` et `modifierPerimetre` reçoivent `groupe` ; `type` reste
  accepté. Le tri des postes et l'appel à candidatures suivent les groupes et
  le nom court de l'activité.
- Slugs d'activité réservés. `Fiche.activite` dans le contrat.
- L'import retire l'activité d'amorçage vide d'un dépôt en `activites/`.
