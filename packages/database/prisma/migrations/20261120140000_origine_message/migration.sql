-- Origine d'un message préparé par une application ou par un jeton d'accès
-- (ADR 0071). Migration additive : toutes les colonnes sont nulles, les messages
-- existants restent sans origine, et une version antérieure ignore ces colonnes.
-- AlterTable
ALTER TABLE `Message` ADD COLUMN `clientApplicationId` VARCHAR(191) NULL,
    ADD COLUMN `jetonAccesId` VARCHAR(191) NULL,
    ADD COLUMN `origineHote` VARCHAR(255) NULL,
    ADD COLUMN `origineNom` VARCHAR(80) NULL,
    ADD COLUMN `origineNonVerifiee` BOOLEAN NULL,
    ADD COLUMN `origineSorte` ENUM('APPLICATION', 'JETON_ACCES') NULL;

-- CreateIndex
CREATE INDEX `Message_clientApplicationId_idx` ON `Message`(`clientApplicationId`);

-- CreateIndex
CREATE INDEX `Message_jetonAccesId_statut_idx` ON `Message`(`jetonAccesId`, `statut`);

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_clientApplicationId_fkey` FOREIGN KEY (`clientApplicationId`) REFERENCES `ClientApplication`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_jetonAccesId_fkey` FOREIGN KEY (`jetonAccesId`) REFERENCES `JetonAcces`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

