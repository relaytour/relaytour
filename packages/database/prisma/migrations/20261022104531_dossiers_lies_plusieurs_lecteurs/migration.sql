-- AlterTable
ALTER TABLE `DossierLie` ADD COLUMN `touteActivite` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `DossierLiePerimetre` (
    `dossierLieId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NOT NULL,

    INDEX `DossierLiePerimetre_perimetreId_idx`(`perimetreId`),
    PRIMARY KEY (`dossierLieId`, `perimetreId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DossierLieGroupe` (
    `dossierLieId` VARCHAR(191) NOT NULL,
    `groupe` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`dossierLieId`, `groupe`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DossierLiePerimetre` ADD CONSTRAINT `DossierLiePerimetre_dossierLieId_fkey` FOREIGN KEY (`dossierLieId`) REFERENCES `DossierLie`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierLiePerimetre` ADD CONSTRAINT `DossierLiePerimetre_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierLieGroupe` ADD CONSTRAINT `DossierLieGroupe_dossierLieId_fkey` FOREIGN KEY (`dossierLieId`) REFERENCES `DossierLie`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des liens existants (ADR 0043) : un lien sans périmètre sert toute
-- l'activité, un lien à un périmètre devient une liste d'un périmètre. La colonne
-- `perimetreId` reste en place pour une version antérieure.
UPDATE `DossierLie` SET `touteActivite` = true WHERE `perimetreId` IS NULL;

INSERT INTO `DossierLiePerimetre` (`dossierLieId`, `perimetreId`)
SELECT `id`, `perimetreId` FROM `DossierLie` WHERE `perimetreId` IS NOT NULL;
