-- CreateTable
CREATE TABLE `ConnexionFichiers` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `fournisseur` ENUM('SHAREPOINT') NOT NULL,
    `compte` VARCHAR(191) NOT NULL,
    `jeton` TEXT NOT NULL,
    `etat` ENUM('ACTIVE', 'A_RECONNECTER') NOT NULL DEFAULT 'ACTIVE',
    `connecteParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConnexionFichiers_organisationId_key`(`organisationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DossierLie` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NULL,
    `fournisseur` ENUM('SHAREPOINT') NOT NULL,
    `emplacement` VARCHAR(255) NOT NULL,
    `element` VARCHAR(255) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DossierLie_activiteId_idx`(`activiteId`),
    INDEX `DossierLie_perimetreId_idx`(`perimetreId`),
    UNIQUE INDEX `DossierLie_organisationId_activiteId_perimetreId_emplacement_key`(`organisationId`, `activiteId`, `perimetreId`, `emplacement`, `element`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConnexionFichiers` ADD CONSTRAINT `ConnexionFichiers_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConnexionFichiers` ADD CONSTRAINT `ConnexionFichiers_connecteParId_fkey` FOREIGN KEY (`connecteParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierLie` ADD CONSTRAINT `DossierLie_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierLie` ADD CONSTRAINT `DossierLie_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierLie` ADD CONSTRAINT `DossierLie_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DossierLie` ADD CONSTRAINT `DossierLie_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
