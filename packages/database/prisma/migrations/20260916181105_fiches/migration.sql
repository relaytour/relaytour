-- AlterTable
ALTER TABLE `Activite` ADD COLUMN `ficheId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE') NOT NULL;

-- AlterTable
ALTER TABLE `Tache` ADD COLUMN `ficheId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Fiche` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NULL,
    `versionCouranteId` VARCHAR(191) NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Fiche_slug_key`(`slug`),
    UNIQUE INDEX `Fiche_versionCouranteId_key`(`versionCouranteId`),
    INDEX `Fiche_perimetreId_idx`(`perimetreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FicheVersion` (
    `id` VARCHAR(191) NOT NULL,
    `ficheId` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(191) NOT NULL,
    `contenu` MEDIUMTEXT NOT NULL,
    `empreinte` CHAR(64) NOT NULL,
    `source` ENUM('GIT', 'APP') NOT NULL,
    `resume` VARCHAR(191) NULL,
    `auteurId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FicheVersion_ficheId_createdAt_idx`(`ficheId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DroitRedaction` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NULL,
    `accordeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DroitRedaction_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Tache` ADD CONSTRAINT `Tache_ficheId_fkey` FOREIGN KEY (`ficheId`) REFERENCES `Fiche`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activite` ADD CONSTRAINT `Activite_ficheId_fkey` FOREIGN KEY (`ficheId`) REFERENCES `Fiche`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fiche` ADD CONSTRAINT `Fiche_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fiche` ADD CONSTRAINT `Fiche_versionCouranteId_fkey` FOREIGN KEY (`versionCouranteId`) REFERENCES `FicheVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FicheVersion` ADD CONSTRAINT `FicheVersion_ficheId_fkey` FOREIGN KEY (`ficheId`) REFERENCES `Fiche`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FicheVersion` ADD CONSTRAINT `FicheVersion_auteurId_fkey` FOREIGN KEY (`auteurId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DroitRedaction` ADD CONSTRAINT `DroitRedaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DroitRedaction` ADD CONSTRAINT `DroitRedaction_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DroitRedaction` ADD CONSTRAINT `DroitRedaction_accordeParId_fkey` FOREIGN KEY (`accordeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
