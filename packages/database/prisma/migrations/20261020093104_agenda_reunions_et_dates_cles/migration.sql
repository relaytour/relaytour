-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `reunionId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'ECHEANCE_PROCHE', 'TACHE_EN_RETARD', 'DEMANDE_RECUE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE', 'DECLINAISON_PROPOSEE', 'DECLINAISON_ACCEPTEE', 'DECLINAISON_REFUSEE', 'TACHE_COMMENTEE', 'INVITATION_ACCEPTEE', 'AFFECTATION_AJOUTEE', 'AFFECTATION_RETIREE', 'SOUHAIT_FORMULE', 'DEMANDE_ACCEPTEE', 'DEMANDE_REFUSEE', 'ADMIN_ACTIVITE_NOMME', 'ADMIN_ACTIVITE_RETIRE', 'ADMIN_ORGANISATION_NOMME', 'ADMIN_ORGANISATION_RETIRE', 'PERSONNE_ARCHIVEE', 'PERSONNE_RETABLIE', 'PLACE_MODIFIEE', 'REUNION_CONVOQUEE', 'REUNION_MODIFIEE', 'REUNION_ANNULEE') NOT NULL;

-- AlterTable
ALTER TABLE `PreferenceOrganisation` ADD COLUMN `pushAgenda` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `DateCle` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `titre` VARCHAR(120) NOT NULL,
    `jour` DATE NOT NULL,
    `jourFin` DATE NULL,
    `description` TEXT NULL,
    `creeParId` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DateCle_editionId_jour_idx`(`editionId`, `jour`),
    INDEX `DateCle_organisationId_idx`(`organisationId`),
    INDEX `DateCle_activiteId_idx`(`activiteId`),
    INDEX `DateCle_creeParId_idx`(`creeParId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reunion` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NULL,
    `titre` VARCHAR(200) NOT NULL,
    `debut` DATETIME(3) NOT NULL,
    `fin` DATETIME(3) NOT NULL,
    `lieu` VARCHAR(200) NULL,
    `lienVisio` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `statut` ENUM('PREVUE', 'ANNULEE') NOT NULL DEFAULT 'PREVUE',
    `cible` ENUM('PERIMETRE', 'EQUIPE', 'CHOIX') NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `creeParId` VARCHAR(191) NULL,
    `annuleeLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Reunion_editionId_debut_idx`(`editionId`, `debut`),
    INDEX `Reunion_perimetreId_debut_idx`(`perimetreId`, `debut`),
    INDEX `Reunion_organisationId_idx`(`organisationId`),
    INDEX `Reunion_activiteId_idx`(`activiteId`),
    INDEX `Reunion_creeParId_idx`(`creeParId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReunionTache` (
    `id` VARCHAR(191) NOT NULL,
    `reunionId` VARCHAR(191) NOT NULL,
    `tacheId` VARCHAR(191) NOT NULL,

    INDEX `ReunionTache_tacheId_idx`(`tacheId`),
    UNIQUE INDEX `ReunionTache_reunionId_tacheId_key`(`reunionId`, `tacheId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConvocationReunion` (
    `id` VARCHAR(191) NOT NULL,
    `reunionId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reponse` ENUM('PRESENT', 'ABSENT', 'PEUT_ETRE') NULL,
    `reponduLe` DATETIME(3) NULL,
    `envoyeeLe` DATETIME(3) NULL,
    `sequenceEnvoyee` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConvocationReunion_userId_idx`(`userId`),
    UNIQUE INDEX `ConvocationReunion_reunionId_userId_key`(`reunionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Notification_reunionId_idx` ON `Notification`(`reunionId`);

-- AddForeignKey
ALTER TABLE `DateCle` ADD CONSTRAINT `DateCle_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DateCle` ADD CONSTRAINT `DateCle_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DateCle` ADD CONSTRAINT `DateCle_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DateCle` ADD CONSTRAINT `DateCle_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reunion` ADD CONSTRAINT `Reunion_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reunion` ADD CONSTRAINT `Reunion_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reunion` ADD CONSTRAINT `Reunion_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reunion` ADD CONSTRAINT `Reunion_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReunionTache` ADD CONSTRAINT `ReunionTache_reunionId_fkey` FOREIGN KEY (`reunionId`) REFERENCES `Reunion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReunionTache` ADD CONSTRAINT `ReunionTache_tacheId_fkey` FOREIGN KEY (`tacheId`) REFERENCES `Tache`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reunion` ADD CONSTRAINT `Reunion_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConvocationReunion` ADD CONSTRAINT `ConvocationReunion_reunionId_fkey` FOREIGN KEY (`reunionId`) REFERENCES `Reunion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConvocationReunion` ADD CONSTRAINT `ConvocationReunion_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_reunionId_fkey` FOREIGN KEY (`reunionId`) REFERENCES `Reunion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
