-- Activité ouverte aux souhaits (ADR 0012). Migration additive : une colonne nouvelle,
-- fausse pour toutes les activités existantes, dont la visibilité ne change pas.

-- AlterTable
ALTER TABLE `Activite` ADD COLUMN `souhaitsOuverts` BOOLEAN NOT NULL DEFAULT false;
