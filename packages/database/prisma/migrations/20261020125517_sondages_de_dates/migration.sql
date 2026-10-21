-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `sondageId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'ECHEANCE_PROCHE', 'TACHE_EN_RETARD', 'DEMANDE_RECUE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE', 'DECLINAISON_PROPOSEE', 'DECLINAISON_ACCEPTEE', 'DECLINAISON_REFUSEE', 'TACHE_COMMENTEE', 'INVITATION_ACCEPTEE', 'AFFECTATION_AJOUTEE', 'AFFECTATION_RETIREE', 'SOUHAIT_FORMULE', 'DEMANDE_ACCEPTEE', 'DEMANDE_REFUSEE', 'ADMIN_ACTIVITE_NOMME', 'ADMIN_ACTIVITE_RETIRE', 'ADMIN_ORGANISATION_NOMME', 'ADMIN_ORGANISATION_RETIRE', 'PERSONNE_ARCHIVEE', 'PERSONNE_RETABLIE', 'PLACE_MODIFIEE', 'REUNION_CONVOQUEE', 'REUNION_MODIFIEE', 'REUNION_ANNULEE', 'SONDAGE_OUVERT') NOT NULL;

-- CreateTable
CREATE TABLE `Sondage` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NULL,
    `titre` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `cible` ENUM('PERIMETRE', 'EQUIPE', 'CHOIX') NOT NULL,
    `statut` ENUM('OUVERT', 'CLOS') NOT NULL DEFAULT 'OUVERT',
    `creneauRetenuId` VARCHAR(191) NULL,
    `reunionId` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `creeParId` VARCHAR(191) NULL,
    `closLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Sondage_creneauRetenuId_key`(`creneauRetenuId`),
    UNIQUE INDEX `Sondage_reunionId_key`(`reunionId`),
    INDEX `Sondage_editionId_idx`(`editionId`),
    INDEX `Sondage_perimetreId_idx`(`perimetreId`),
    INDEX `Sondage_organisationId_idx`(`organisationId`),
    INDEX `Sondage_activiteId_idx`(`activiteId`),
    INDEX `Sondage_creeParId_idx`(`creeParId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreneauSondage` (
    `id` VARCHAR(191) NOT NULL,
    `sondageId` VARCHAR(191) NOT NULL,
    `jour` DATE NOT NULL,
    `heureDebut` VARCHAR(5) NULL,
    `heureFin` VARCHAR(5) NULL,
    `ordre` INTEGER NOT NULL DEFAULT 0,

    INDEX `CreneauSondage_sondageId_ordre_idx`(`sondageId`, `ordre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParticipantSondage` (
    `id` VARCHAR(191) NOT NULL,
    `sondageId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ParticipantSondage_userId_idx`(`userId`),
    UNIQUE INDEX `ParticipantSondage_sondageId_userId_key`(`sondageId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReponseSondage` (
    `id` VARCHAR(191) NOT NULL,
    `creneauId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `choix` ENUM('OUI', 'SI_BESOIN', 'NON') NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReponseSondage_userId_idx`(`userId`),
    UNIQUE INDEX `ReponseSondage_creneauId_userId_key`(`creneauId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Notification_sondageId_idx` ON `Notification`(`sondageId`);

-- AddForeignKey
ALTER TABLE `Sondage` ADD CONSTRAINT `Sondage_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sondage` ADD CONSTRAINT `Sondage_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sondage` ADD CONSTRAINT `Sondage_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sondage` ADD CONSTRAINT `Sondage_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sondage` ADD CONSTRAINT `Sondage_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sondage` ADD CONSTRAINT `Sondage_creneauRetenuId_fkey` FOREIGN KEY (`creneauRetenuId`) REFERENCES `CreneauSondage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sondage` ADD CONSTRAINT `Sondage_reunionId_fkey` FOREIGN KEY (`reunionId`) REFERENCES `Reunion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreneauSondage` ADD CONSTRAINT `CreneauSondage_sondageId_fkey` FOREIGN KEY (`sondageId`) REFERENCES `Sondage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantSondage` ADD CONSTRAINT `ParticipantSondage_sondageId_fkey` FOREIGN KEY (`sondageId`) REFERENCES `Sondage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParticipantSondage` ADD CONSTRAINT `ParticipantSondage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReponseSondage` ADD CONSTRAINT `ReponseSondage_creneauId_fkey` FOREIGN KEY (`creneauId`) REFERENCES `CreneauSondage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReponseSondage` ADD CONSTRAINT `ReponseSondage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_sondageId_fkey` FOREIGN KEY (`sondageId`) REFERENCES `Sondage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
