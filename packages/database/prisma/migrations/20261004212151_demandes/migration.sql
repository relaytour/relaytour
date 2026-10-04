-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `activiteId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'ECHEANCE_PROCHE', 'TACHE_EN_RETARD', 'DEMANDE_RECUE') NOT NULL;

-- CreateTable
CREATE TABLE `Demande` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `origine` ENUM('PROPOSITION', 'FORMULAIRE') NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE') NOT NULL DEFAULT 'EN_ATTENTE',
    `nom` VARCHAR(191) NOT NULL,
    `adresse` VARCHAR(191) NOT NULL,
    `adresseEnAttente` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `traiteeParId` VARCHAR(191) NULL,
    `traiteeLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Demande_editionId_statut_createdAt_idx`(`editionId`, `statut`, `createdAt`),
    INDEX `Demande_organisationId_idx`(`organisationId`),
    INDEX `Demande_activiteId_idx`(`activiteId`),
    UNIQUE INDEX `Demande_editionId_adresseEnAttente_key`(`editionId`, `adresseEnAttente`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DemandePerimetre` (
    `id` VARCHAR(191) NOT NULL,
    `demandeId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NOT NULL,
    `proposeParId` VARCHAR(191) NULL,
    `mot` VARCHAR(280) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DemandePerimetre_perimetreId_idx`(`perimetreId`),
    INDEX `DemandePerimetre_proposeParId_idx`(`proposeParId`),
    UNIQUE INDEX `DemandePerimetre_demandeId_perimetreId_proposeParId_key`(`demandeId`, `perimetreId`, `proposeParId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Demande` ADD CONSTRAINT `Demande_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Demande` ADD CONSTRAINT `Demande_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Demande` ADD CONSTRAINT `Demande_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Demande` ADD CONSTRAINT `Demande_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Demande` ADD CONSTRAINT `Demande_traiteeParId_fkey` FOREIGN KEY (`traiteeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemandePerimetre` ADD CONSTRAINT `DemandePerimetre_demandeId_fkey` FOREIGN KEY (`demandeId`) REFERENCES `Demande`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemandePerimetre` ADD CONSTRAINT `DemandePerimetre_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemandePerimetre` ADD CONSTRAINT `DemandePerimetre_proposeParId_fkey` FOREIGN KEY (`proposeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
