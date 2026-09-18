-- CreateTable
CREATE TABLE `Tache` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `echeance` DATE NULL,
    `statut` ENUM('A_FAIRE', 'EN_COURS', 'FAITE', 'ABANDONNEE') NOT NULL DEFAULT 'A_FAIRE',
    `modeleSlug` VARCHAR(191) NULL,
    `creeParId` VARCHAR(191) NULL,
    `termineeLe` DATETIME(3) NULL,
    `clotureeParId` VARCHAR(191) NULL,
    `realiseeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Tache_editionId_perimetreId_idx`(`editionId`, `perimetreId`),
    INDEX `Tache_editionId_echeance_idx`(`editionId`, `echeance`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TacheAssignation` (
    `id` VARCHAR(191) NOT NULL,
    `tacheId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TacheAssignation_userId_idx`(`userId`),
    UNIQUE INDEX `TacheAssignation_tacheId_userId_key`(`tacheId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activite` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'TACHE_STATUT') NOT NULL,
    `acteurId` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NOT NULL,
    `tacheId` VARCHAR(191) NULL,
    `personneId` VARCHAR(191) NULL,
    `statut` ENUM('A_FAIRE', 'EN_COURS', 'FAITE', 'ABANDONNEE') NULL,
    `realiseeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Activite_acteurId_createdAt_idx`(`acteurId`, `createdAt`),
    INDEX `Activite_editionId_perimetreId_createdAt_idx`(`editionId`, `perimetreId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Tache` ADD CONSTRAINT `Tache_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tache` ADD CONSTRAINT `Tache_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tache` ADD CONSTRAINT `Tache_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tache` ADD CONSTRAINT `Tache_clotureeParId_fkey` FOREIGN KEY (`clotureeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tache` ADD CONSTRAINT `Tache_realiseeParId_fkey` FOREIGN KEY (`realiseeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TacheAssignation` ADD CONSTRAINT `TacheAssignation_tacheId_fkey` FOREIGN KEY (`tacheId`) REFERENCES `Tache`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TacheAssignation` ADD CONSTRAINT `TacheAssignation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activite` ADD CONSTRAINT `Activite_acteurId_fkey` FOREIGN KEY (`acteurId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activite` ADD CONSTRAINT `Activite_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activite` ADD CONSTRAINT `Activite_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activite` ADD CONSTRAINT `Activite_tacheId_fkey` FOREIGN KEY (`tacheId`) REFERENCES `Tache`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
