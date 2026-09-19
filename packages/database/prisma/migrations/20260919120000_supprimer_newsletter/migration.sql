-- Supprime la table Newsletter, héritée du projet précédent et sans usage dans Relaytour.
-- Migration destructive : les adresses qu'elle contient encore disparaissent.
DROP TABLE `Newsletter`;
