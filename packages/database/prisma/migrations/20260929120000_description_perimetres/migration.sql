-- Description d'un périmètre (ADR 0012). Migration additive : une colonne nouvelle, vide
-- pour les périmètres existants.

-- AlterTable
ALTER TABLE `Perimetre` ADD COLUMN `description` TEXT NULL;
