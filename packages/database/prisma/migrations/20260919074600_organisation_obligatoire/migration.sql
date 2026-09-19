-- Rend la clé d'organisation obligatoire (ADR 0006, lot commun).
-- Une installation qui n'a jamais démarré depuis la migration précédente n'a pas de
-- ligne Organisation : une ligne d'amorçage « defaut » est posée, complétée au
-- prochain démarrage depuis l'environnement. Les lignes sans clé sont rattachées
-- à la première organisation avant que la colonne devienne obligatoire.
INSERT INTO `Organisation` (`id`, `slug`, `nom`, `configuration`, `createdAt`, `updatedAt`)
SELECT 'org_defaut', 'defaut', 'Organisation', '{}', NOW(3), NOW(3) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `Organisation`);

UPDATE `Edition` SET `organisationId` = (SELECT `id` FROM `Organisation` ORDER BY `createdAt` LIMIT 1) WHERE `organisationId` IS NULL;
UPDATE `Perimetre` SET `organisationId` = (SELECT `id` FROM `Organisation` ORDER BY `createdAt` LIMIT 1) WHERE `organisationId` IS NULL;
UPDATE `Fiche` SET `organisationId` = (SELECT `id` FROM `Organisation` ORDER BY `createdAt` LIMIT 1) WHERE `organisationId` IS NULL;
UPDATE `Notification` SET `organisationId` = (SELECT `id` FROM `Organisation` ORDER BY `createdAt` LIMIT 1) WHERE `organisationId` IS NULL;
UPDATE `PreferenceNotification` SET `organisationId` = (SELECT `id` FROM `Organisation` ORDER BY `createdAt` LIMIT 1) WHERE `organisationId` IS NULL;

/*
  Warnings:

  - Made the column `organisationId` on table `Edition` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organisationId` on table `Fiche` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organisationId` on table `Notification` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organisationId` on table `Perimetre` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organisationId` on table `PreferenceNotification` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_organisationId_fkey`;

-- DropForeignKey
ALTER TABLE `Fiche` DROP FOREIGN KEY `Fiche_organisationId_fkey`;

-- DropForeignKey
ALTER TABLE `Notification` DROP FOREIGN KEY `Notification_organisationId_fkey`;

-- DropForeignKey
ALTER TABLE `Perimetre` DROP FOREIGN KEY `Perimetre_organisationId_fkey`;

-- DropForeignKey
ALTER TABLE `PreferenceNotification` DROP FOREIGN KEY `PreferenceNotification_organisationId_fkey`;

-- AlterTable
ALTER TABLE `Edition` MODIFY `organisationId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Fiche` MODIFY `organisationId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `organisationId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Perimetre` MODIFY `organisationId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `PreferenceNotification` MODIFY `organisationId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Perimetre` ADD CONSTRAINT `Perimetre_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fiche` ADD CONSTRAINT `Fiche_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreferenceNotification` ADD CONSTRAINT `PreferenceNotification_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
