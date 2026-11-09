-- AlterTable
ALTER TABLE `Organisation` ADD COLUMN `apiActivee` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `apiAutorisee` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `apiImposee` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `apiSuspendueLe` DATETIME(3) NULL,
    ADD COLUMN `apiSuspensionMotif` VARCHAR(500) NULL;

-- CreateTable
CREATE TABLE `JetonAcces` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `creeParId` VARCHAR(191) NULL,
    `nom` VARCHAR(80) NOT NULL,
    `empreinte` CHAR(64) NOT NULL,
    `apercu` VARCHAR(8) NOT NULL,
    `portee` ENUM('LECTURE', 'LECTURE_ECRITURE') NOT NULL DEFAULT 'LECTURE',
    `activiteIds` JSON NULL,
    `expireLe` DATETIME(3) NOT NULL,
    `dernierAccesLe` DATETIME(3) NULL,
    `revoqueLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `JetonAcces_empreinte_idx`(`empreinte`),
    INDEX `JetonAcces_organisationId_userId_idx`(`organisationId`, `userId`),
    INDEX `JetonAcces_userId_idx`(`userId`),
    INDEX `JetonAcces_creeParId_idx`(`creeParId`),
    UNIQUE INDEX `JetonAcces_organisationId_empreinte_key`(`organisationId`, `empreinte`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `JetonAcces` ADD CONSTRAINT `JetonAcces_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JetonAcces` ADD CONSTRAINT `JetonAcces_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JetonAcces` ADD CONSTRAINT `JetonAcces_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

