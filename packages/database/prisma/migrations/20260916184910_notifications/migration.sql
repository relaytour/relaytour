-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'ECHEANCE_PROCHE', 'TACHE_EN_RETARD') NOT NULL,
    `acteurId` VARCHAR(191) NULL,
    `tacheId` VARCHAR(191) NULL,
    `perimetreId` VARCHAR(191) NULL,
    `personneId` VARCHAR(191) NULL,
    `jours` INTEGER NULL,
    `cle` VARCHAR(191) NULL,
    `lueLe` DATETIME(3) NULL,
    `envoyeeLe` DATETIME(3) NULL,
    `resumeeLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Notification_cle_key`(`cle`),
    INDEX `Notification_userId_lueLe_createdAt_idx`(`userId`, `lueLe`, `createdAt`),
    INDEX `Notification_userId_resumeeLe_idx`(`userId`, `resumeeLe`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreferenceNotification` (
    `userId` VARCHAR(191) NOT NULL,
    `frequenceResume` ENUM('QUOTIDIEN', 'HEBDOMADAIRE', 'AUCUN') NOT NULL DEFAULT 'HEBDOMADAIRE',
    `mailModification` BOOLEAN NOT NULL DEFAULT true,
    `mailEcheance` BOOLEAN NOT NULL DEFAULT true,
    `dernierResumeLe` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_tacheId_fkey` FOREIGN KEY (`tacheId`) REFERENCES `Tache`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreferenceNotification` ADD CONSTRAINT `PreferenceNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
