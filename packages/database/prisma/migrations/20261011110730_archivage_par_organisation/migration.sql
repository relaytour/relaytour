-- AlterTable
ALTER TABLE `Appartenance` ADD COLUMN `archiveLe` DATETIME(3) NULL;

-- Les comptes déjà archivés (ADR 0031) : leur date d'archivage se reporte sur toutes
-- leurs appartenances. `User.archivedAt` ne change pas.
UPDATE `Appartenance` a
INNER JOIN `User` u ON u.`id` = a.`userId`
SET a.`archiveLe` = u.`archivedAt`
WHERE u.`archivedAt` IS NOT NULL;
