---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
fr:
  titre: >-
    Une affectation peut porter la marque de contact principal
  texte: >-
    Un admin d'activité désigne le contact principal d'un périmètre pour une
    édition. Un périmètre en a un seul par édition. La marque ne donne aucun
    droit et figure dans l'export de l'organisation.
---

- Migration additive `20260929100000_contact_principal` :
  `Affectation.contactPrincipal`, faux par défaut.
- Mutation `definirContactPrincipal(affectationId, contactPrincipal)` :
  scope `gestion`, admin de l'activité du périmètre, faux hors de ses
  activités, refus sur une édition archivée. L'unicité par périmètre et par
  édition se garde dans une transaction.
- `Perimetre.contactPrincipal(editionId)` et `Perimetre.referents` qui place
  le contact principal en tête.
- Refus croisés : la mutation entre dans la table. Test dédié :
  `contact-principal.integration.test.ts`.
- ADR 0011.
