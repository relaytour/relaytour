-- Contact principal d'un périmètre pour une édition (ADR 0011). Migration additive :
-- une colonne nouvelle, fausse pour toutes les affectations existantes.

-- AlterTable
ALTER TABLE `Affectation` ADD COLUMN `contactPrincipal` BOOLEAN NOT NULL DEFAULT false;
