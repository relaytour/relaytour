---
cible: serveur
type: rupture
audience: interne
etat: prevu
version: 0.4.0
fr:
  titre: >-
    La newsletter quitte le périmètre publié
  texte: >-
    La mutation d'inscription à la newsletter et le compteur d'abonnés,
    hérités du projet précédent, disparaissent de l'API. La table reste en
    base sans usage ; sa suppression fera l'objet d'une migration à part.
  migration: >-
    Un client qui appelait subscribeNewsletter ou nombreAbonnesNewsletter
    doit retirer ces appels. Aucune action en base.
---

- `src/schema/newsletter.ts` supprimé ; `schema.graphql` et les types de
  l'espace organisateur régénérés.
- Le script `db:seed` ne pose plus aucune donnée.
