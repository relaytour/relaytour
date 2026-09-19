---
cible: serveur
type: rupture
audience: interne
etat: prevu
fr:
  titre: >-
    La table Newsletter est supprimée
  texte: >-
    La table Newsletter, héritée du projet précédent et sans usage dans
    Relaytour, disparaît du schéma. La migration la supprime avec les
    adresses qu'elle contient encore.
  migration: >-
    Exporter la table Newsletter avant de déployer si ses adresses doivent
    être conservées ailleurs. La migration exécute DROP TABLE.
---

- Modèle `Newsletter` retiré de `schema.prisma`.
- Migration `20260919120000_supprimer_newsletter`, seule migration
  destructive du dépôt, décidée le 19 septembre 2026.
