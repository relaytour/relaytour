-- CreateTable
CREATE TABLE `Lieu` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `ordre` INTEGER NOT NULL DEFAULT 0,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lieu_activiteId_ordre_idx`(`activiteId`, `ordre`),
    INDEX `Lieu_organisationId_idx`(`organisationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sequence` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NULL,
    `lieuId` VARCHAR(191) NULL,
    `titre` VARCHAR(200) NOT NULL,
    `debut` DATETIME(3) NOT NULL,
    `fin` DATETIME(3) NOT NULL,
    `description` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Sequence_editionId_debut_idx`(`editionId`, `debut`),
    INDEX `Sequence_perimetreId_idx`(`perimetreId`),
    INDEX `Sequence_lieuId_idx`(`lieuId`),
    INDEX `Sequence_organisationId_idx`(`organisationId`),
    INDEX `Sequence_activiteId_idx`(`activiteId`),
    INDEX `Sequence_creeParId_idx`(`creeParId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlaceSequence` (
    `id` VARCHAR(191) NOT NULL,
    `sequenceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `benevoleId` VARCHAR(191) NULL,
    `role` ENUM('RESPONSABLE', 'RENFORT') NOT NULL DEFAULT 'RENFORT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PlaceSequence_userId_idx`(`userId`),
    INDEX `PlaceSequence_benevoleId_idx`(`benevoleId`),
    UNIQUE INDEX `PlaceSequence_sequenceId_userId_key`(`sequenceId`, `userId`),
    UNIQUE INDEX `PlaceSequence_sequenceId_benevoleId_key`(`sequenceId`, `benevoleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Benevole` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(120) NOT NULL,
    `courriel` VARCHAR(254) NULL,
    `telephone` VARCHAR(40) NULL,
    `note` TEXT NULL,
    `accordLe` DATETIME(3) NOT NULL,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Benevole_activiteId_nom_idx`(`activiteId`, `nom`),
    INDEX `Benevole_organisationId_idx`(`organisationId`),
    INDEX `Benevole_creeParId_idx`(`creeParId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Lieu` ADD CONSTRAINT `Lieu_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lieu` ADD CONSTRAINT `Lieu_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sequence` ADD CONSTRAINT `Sequence_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sequence` ADD CONSTRAINT `Sequence_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sequence` ADD CONSTRAINT `Sequence_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sequence` ADD CONSTRAINT `Sequence_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sequence` ADD CONSTRAINT `Sequence_lieuId_fkey` FOREIGN KEY (`lieuId`) REFERENCES `Lieu`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sequence` ADD CONSTRAINT `Sequence_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaceSequence` ADD CONSTRAINT `PlaceSequence_sequenceId_fkey` FOREIGN KEY (`sequenceId`) REFERENCES `Sequence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaceSequence` ADD CONSTRAINT `PlaceSequence_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaceSequence` ADD CONSTRAINT `PlaceSequence_benevoleId_fkey` FOREIGN KEY (`benevoleId`) REFERENCES `Benevole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Benevole` ADD CONSTRAINT `Benevole_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Benevole` ADD CONSTRAINT `Benevole_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Benevole` ADD CONSTRAINT `Benevole_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Une place désigne un compte ou une fiche bénévole, jamais les deux (ADR 0040).
ALTER TABLE `PlaceSequence` ADD CONSTRAINT `PlaceSequence_personne_check` CHECK ((`userId` IS NULL) <> (`benevoleId` IS NULL));
