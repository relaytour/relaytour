-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NULL,
    `editionId` VARCHAR(191) NULL,
    `perimetreId` VARCHAR(191) NULL,
    `auteurId` VARCHAR(191) NULL,
    `modele` VARCHAR(60) NOT NULL,
    `objet` VARCHAR(200) NOT NULL,
    `corps` TEXT NOT NULL,
    `champ` ENUM('A', 'CC', 'CCI') NOT NULL,
    `statut` ENUM('EN_COURS', 'ENVOYE', 'ANNULE') NOT NULL DEFAULT 'EN_COURS',
    `statutLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Message_organisationId_createdAt_idx`(`organisationId`, `createdAt`),
    INDEX `Message_activiteId_createdAt_idx`(`activiteId`, `createdAt`),
    INDEX `Message_editionId_idx`(`editionId`),
    INDEX `Message_perimetreId_idx`(`perimetreId`),
    INDEX `Message_auteurId_idx`(`auteurId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MessageDestinataire` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `enCopie` BOOLEAN NOT NULL DEFAULT false,

    INDEX `MessageDestinataire_userId_idx`(`userId`),
    UNIQUE INDEX `MessageDestinataire_messageId_userId_key`(`messageId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_auteurId_fkey` FOREIGN KEY (`auteurId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageDestinataire` ADD CONSTRAINT `MessageDestinataire_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageDestinataire` ADD CONSTRAINT `MessageDestinataire_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

