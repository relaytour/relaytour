-- AlterTable
ALTER TABLE `AppelBenevoles` ADD COLUMN `sansAdresse` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sourceImport` VARCHAR(120) NULL;

-- AlterTable
ALTER TABLE `Benevole` ADD COLUMN `perimetreImportId` VARCHAR(191) NULL,
    ADD COLUMN `precisionsDisponibilite` VARCHAR(600) NULL,
    ADD COLUMN `sourceImport` VARCHAR(120) NULL,
    MODIFY `origine` ENUM('SAISIE', 'CANDIDATURE', 'IMPORT') NOT NULL DEFAULT 'SAISIE';

-- AlterTable
ALTER TABLE `Candidature` ADD COLUMN `origine` ENUM('PUBLIC', 'IMPORT') NOT NULL DEFAULT 'PUBLIC',
    ADD COLUMN `refExterne` VARCHAR(120) NULL,
    ADD COLUMN `sourceImport` VARCHAR(120) NULL;

-- CreateTable
CREATE TABLE `CorrespondanceImport` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(120) NOT NULL,
    `entetes` JSON NOT NULL,
    `associations` JSON NOT NULL,
    `reglages` JSON NOT NULL,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CorrespondanceImport_organisationId_idx`(`organisationId`),
    INDEX `CorrespondanceImport_creeParId_idx`(`creeParId`),
    UNIQUE INDEX `CorrespondanceImport_activiteId_nom_key`(`activiteId`, `nom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaireDistincte` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `benevoleAId` VARCHAR(191) NOT NULL,
    `benevoleBId` VARCHAR(191) NOT NULL,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaireDistincte_organisationId_idx`(`organisationId`),
    INDEX `PaireDistincte_benevoleAId_idx`(`benevoleAId`),
    INDEX `PaireDistincte_benevoleBId_idx`(`benevoleBId`),
    INDEX `PaireDistincte_creeParId_idx`(`creeParId`),
    UNIQUE INDEX `PaireDistincte_activiteId_benevoleAId_benevoleBId_key`(`activiteId`, `benevoleAId`, `benevoleBId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `AppelBenevoles_editionId_sourceImport_key` ON `AppelBenevoles`(`editionId`, `sourceImport`);

-- CreateIndex
CREATE INDEX `Benevole_perimetreImportId_idx` ON `Benevole`(`perimetreImportId`);

-- CreateIndex
CREATE UNIQUE INDEX `Candidature_appelId_refExterne_key` ON `Candidature`(`appelId`, `refExterne`);

-- AddForeignKey
ALTER TABLE `Benevole` ADD CONSTRAINT `Benevole_perimetreImportId_fkey` FOREIGN KEY (`perimetreImportId`) REFERENCES `Perimetre`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorrespondanceImport` ADD CONSTRAINT `CorrespondanceImport_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorrespondanceImport` ADD CONSTRAINT `CorrespondanceImport_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorrespondanceImport` ADD CONSTRAINT `CorrespondanceImport_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaireDistincte` ADD CONSTRAINT `PaireDistincte_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaireDistincte` ADD CONSTRAINT `PaireDistincte_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaireDistincte` ADD CONSTRAINT `PaireDistincte_benevoleAId_fkey` FOREIGN KEY (`benevoleAId`) REFERENCES `Benevole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaireDistincte` ADD CONSTRAINT `PaireDistincte_benevoleBId_fkey` FOREIGN KEY (`benevoleBId`) REFERENCES `Benevole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaireDistincte` ADD CONSTRAINT `PaireDistincte_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

