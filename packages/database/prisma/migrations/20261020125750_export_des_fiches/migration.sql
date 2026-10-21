-- AlterTable
ALTER TABLE `ConnexionFichiers` ADD COLUMN `exportAncetres` JSON NULL,
    ADD COLUMN `exportElement` VARCHAR(255) NULL,
    ADD COLUMN `exportEmplacement` VARCHAR(255) NULL,
    ADD COLUMN `exportLe` DATETIME(3) NULL,
    ADD COLUMN `exportNom` VARCHAR(1024) NULL,
    ADD COLUMN `exportRapport` JSON NULL;

-- CreateTable
CREATE TABLE `FicheExportee` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `ficheId` VARCHAR(191) NOT NULL,
    `chemin` JSON NOT NULL,
    `empreinte` CHAR(64) NOT NULL,
    `etag` VARCHAR(255) NULL,
    `exporteeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FicheExportee_ficheId_key`(`ficheId`),
    INDEX `FicheExportee_organisationId_idx`(`organisationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FicheExportee` ADD CONSTRAINT `FicheExportee_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FicheExportee` ADD CONSTRAINT `FicheExportee_ficheId_fkey` FOREIGN KEY (`ficheId`) REFERENCES `Fiche`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
