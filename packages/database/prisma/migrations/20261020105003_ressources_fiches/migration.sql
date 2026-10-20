-- CreateTable
CREATE TABLE `RessourceFiche` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `ficheId` VARCHAR(191) NOT NULL,
    `dossierLieId` VARCHAR(191) NOT NULL,
    `chemin` JSON NOT NULL,
    `empreinteChemin` CHAR(64) NOT NULL,
    `type` ENUM('DOSSIER', 'FICHIER') NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RessourceFiche_dossierLieId_idx`(`dossierLieId`),
    INDEX `RessourceFiche_organisationId_idx`(`organisationId`),
    UNIQUE INDEX `RessourceFiche_ficheId_dossierLieId_empreinteChemin_key`(`ficheId`, `dossierLieId`, `empreinteChemin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RessourceFiche` ADD CONSTRAINT `RessourceFiche_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RessourceFiche` ADD CONSTRAINT `RessourceFiche_ficheId_fkey` FOREIGN KEY (`ficheId`) REFERENCES `Fiche`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RessourceFiche` ADD CONSTRAINT `RessourceFiche_dossierLieId_fkey` FOREIGN KEY (`dossierLieId`) REFERENCES `DossierLie`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RessourceFiche` ADD CONSTRAINT `RessourceFiche_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
