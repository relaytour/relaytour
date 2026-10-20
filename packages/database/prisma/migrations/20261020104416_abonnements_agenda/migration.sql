-- CreateTable
CREATE TABLE `AbonnementAgenda` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `sorte` ENUM('PERSONNEL', 'ACTIVITE') NOT NULL,
    `userId` VARCHAR(191) NULL,
    `activiteId` VARCHAR(191) NULL,
    `empreinte` CHAR(64) NOT NULL,
    `fin` VARCHAR(8) NOT NULL,
    `perimetreIds` JSON NULL,
    `inclureGlobal` BOOLEAN NOT NULL DEFAULT true,
    `inclureEcheances` BOOLEAN NOT NULL DEFAULT false,
    `dernierAccesLe` DATETIME(3) NULL,
    `revoqueLe` DATETIME(3) NULL,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AbonnementAgenda_empreinte_idx`(`empreinte`),
    INDEX `AbonnementAgenda_userId_idx`(`userId`),
    INDEX `AbonnementAgenda_activiteId_idx`(`activiteId`),
    INDEX `AbonnementAgenda_creeParId_idx`(`creeParId`),
    UNIQUE INDEX `AbonnementAgenda_organisationId_empreinte_key`(`organisationId`, `empreinte`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AbonnementAgenda` ADD CONSTRAINT `AbonnementAgenda_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AbonnementAgenda` ADD CONSTRAINT `AbonnementAgenda_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AbonnementAgenda` ADD CONSTRAINT `AbonnementAgenda_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AbonnementAgenda` ADD CONSTRAINT `AbonnementAgenda_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
