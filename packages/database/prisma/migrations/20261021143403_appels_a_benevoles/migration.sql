-- AlterTable
ALTER TABLE `Benevole` ADD COLUMN `courrielConfirmeLe` DATETIME(3) NULL,
    ADD COLUMN `espaceEmpreinte` CHAR(64) NULL,
    ADD COLUMN `espaceSel` CHAR(43) NULL,
    ADD COLUMN `lienEnvoyeLe` DATETIME(3) NULL,
    ADD COLUMN `origine` ENUM('SAISIE', 'CANDIDATURE') NOT NULL DEFAULT 'SAISIE',
    ADD COLUMN `prevenirParMail` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `relanceLe` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `benevoleId` VARCHAR(191) NULL,
    ADD COLUMN `sequenceId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'ECHEANCE_PROCHE', 'TACHE_EN_RETARD', 'DEMANDE_RECUE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE', 'DECLINAISON_PROPOSEE', 'DECLINAISON_ACCEPTEE', 'DECLINAISON_REFUSEE', 'TACHE_COMMENTEE', 'INVITATION_ACCEPTEE', 'AFFECTATION_AJOUTEE', 'AFFECTATION_RETIREE', 'SOUHAIT_FORMULE', 'DEMANDE_ACCEPTEE', 'DEMANDE_REFUSEE', 'ADMIN_ACTIVITE_NOMME', 'ADMIN_ACTIVITE_RETIRE', 'ADMIN_ORGANISATION_NOMME', 'ADMIN_ORGANISATION_RETIRE', 'PERSONNE_ARCHIVEE', 'PERSONNE_RETABLIE', 'PLACE_MODIFIEE', 'REUNION_CONVOQUEE', 'REUNION_MODIFIEE', 'REUNION_ANNULEE', 'SONDAGE_OUVERT', 'FICHE_CONNEXE', 'CANDIDATURE_RECUE', 'BENEVOLE_RETIRE') NOT NULL;

-- AlterTable
ALTER TABLE `PlaceSequence` ADD COLUMN `confirmeeLe` DATETIME(3) NULL;

-- Les places existantes ont été saisies par l'équipe : elles naissent confirmées (ADR 0041).
UPDATE `PlaceSequence` SET `confirmeeLe` = `createdAt` WHERE `confirmeeLe` IS NULL;

-- AlterTable
ALTER TABLE `Sequence` ADD COLUMN `besoinBenevoles` INTEGER NULL,
    ADD COLUMN `consignesBenevoles` TEXT NULL;

-- CreateTable
CREATE TABLE `AppelBenevoles` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `portee` ENUM('PERIODE', 'PERIMETRE', 'SEQUENCE') NOT NULL,
    `perimetreId` VARCHAR(191) NULL,
    `sequenceId` VARCHAR(191) NULL,
    `nom` VARCHAR(120) NOT NULL,
    `introduction` TEXT NULL,
    `ouvertLe` DATETIME(3) NOT NULL,
    `fermeLe` DATETIME(3) NOT NULL,
    `fermeManuellementLe` DATETIME(3) NULL,
    `sel` CHAR(43) NOT NULL,
    `empreinte` CHAR(64) NOT NULL,
    `fin` VARCHAR(8) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AppelBenevoles_empreinte_idx`(`empreinte`),
    INDEX `AppelBenevoles_editionId_idx`(`editionId`),
    INDEX `AppelBenevoles_activiteId_idx`(`activiteId`),
    INDEX `AppelBenevoles_perimetreId_idx`(`perimetreId`),
    INDEX `AppelBenevoles_sequenceId_idx`(`sequenceId`),
    INDEX `AppelBenevoles_creeParId_idx`(`creeParId`),
    UNIQUE INDEX `AppelBenevoles_organisationId_empreinte_key`(`organisationId`, `empreinte`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Candidature` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `appelId` VARCHAR(191) NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'TRAITEE', 'RETIREE') NOT NULL DEFAULT 'EN_ATTENTE',
    `nom` VARCHAR(120) NOT NULL,
    `courriel` VARCHAR(254) NULL,
    `courrielEnAttente` VARCHAR(254) NULL,
    `telephone` VARCHAR(40) NULL,
    `message` VARCHAR(600) NULL,
    `precisionsDisponibilite` VARCHAR(600) NULL,
    `ouAilleurs` BOOLEAN NOT NULL DEFAULT false,
    `accordLe` DATETIME(3) NOT NULL,
    `benevoleId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Candidature_appelId_statut_createdAt_idx`(`appelId`, `statut`, `createdAt`),
    INDEX `Candidature_editionId_statut_idx`(`editionId`, `statut`),
    INDEX `Candidature_organisationId_idx`(`organisationId`),
    INDEX `Candidature_activiteId_idx`(`activiteId`),
    INDEX `Candidature_benevoleId_idx`(`benevoleId`),
    UNIQUE INDEX `Candidature_appelId_courrielEnAttente_key`(`appelId`, `courrielEnAttente`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChoixCandidature` (
    `id` VARCHAR(191) NOT NULL,
    `candidatureId` VARCHAR(191) NOT NULL,
    `sequenceId` VARCHAR(191) NOT NULL,
    `statut` ENUM('EN_ATTENTE', 'LISTE_ATTENTE', 'ACCEPTE', 'REFUSE') NOT NULL,
    `traiteParId` VARCHAR(191) NULL,
    `traiteLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChoixCandidature_sequenceId_statut_idx`(`sequenceId`, `statut`),
    INDEX `ChoixCandidature_traiteParId_idx`(`traiteParId`),
    UNIQUE INDEX `ChoixCandidature_candidatureId_sequenceId_key`(`candidatureId`, `sequenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlageDisponibilite` (
    `id` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `candidatureId` VARCHAR(191) NULL,
    `benevoleId` VARCHAR(191) NULL,
    `debut` DATETIME(3) NOT NULL,
    `fin` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PlageDisponibilite_editionId_debut_idx`(`editionId`, `debut`),
    INDEX `PlageDisponibilite_candidatureId_idx`(`candidatureId`),
    INDEX `PlageDisponibilite_benevoleId_editionId_idx`(`benevoleId`, `editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Benevole_espaceEmpreinte_idx` ON `Benevole`(`espaceEmpreinte`);

-- CreateIndex
CREATE UNIQUE INDEX `Benevole_organisationId_espaceEmpreinte_key` ON `Benevole`(`organisationId`, `espaceEmpreinte`);

-- CreateIndex
CREATE INDEX `Notification_sequenceId_idx` ON `Notification`(`sequenceId`);

-- CreateIndex
CREATE INDEX `Notification_benevoleId_idx` ON `Notification`(`benevoleId`);

-- AddForeignKey
ALTER TABLE `AppelBenevoles` ADD CONSTRAINT `AppelBenevoles_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppelBenevoles` ADD CONSTRAINT `AppelBenevoles_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppelBenevoles` ADD CONSTRAINT `AppelBenevoles_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppelBenevoles` ADD CONSTRAINT `AppelBenevoles_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppelBenevoles` ADD CONSTRAINT `AppelBenevoles_sequenceId_fkey` FOREIGN KEY (`sequenceId`) REFERENCES `Sequence`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AppelBenevoles` ADD CONSTRAINT `AppelBenevoles_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candidature` ADD CONSTRAINT `Candidature_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candidature` ADD CONSTRAINT `Candidature_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candidature` ADD CONSTRAINT `Candidature_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candidature` ADD CONSTRAINT `Candidature_appelId_fkey` FOREIGN KEY (`appelId`) REFERENCES `AppelBenevoles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candidature` ADD CONSTRAINT `Candidature_benevoleId_fkey` FOREIGN KEY (`benevoleId`) REFERENCES `Benevole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChoixCandidature` ADD CONSTRAINT `ChoixCandidature_candidatureId_fkey` FOREIGN KEY (`candidatureId`) REFERENCES `Candidature`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChoixCandidature` ADD CONSTRAINT `ChoixCandidature_sequenceId_fkey` FOREIGN KEY (`sequenceId`) REFERENCES `Sequence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChoixCandidature` ADD CONSTRAINT `ChoixCandidature_traiteParId_fkey` FOREIGN KEY (`traiteParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlageDisponibilite` ADD CONSTRAINT `PlageDisponibilite_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlageDisponibilite` ADD CONSTRAINT `PlageDisponibilite_candidatureId_fkey` FOREIGN KEY (`candidatureId`) REFERENCES `Candidature`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlageDisponibilite` ADD CONSTRAINT `PlageDisponibilite_benevoleId_fkey` FOREIGN KEY (`benevoleId`) REFERENCES `Benevole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_sequenceId_fkey` FOREIGN KEY (`sequenceId`) REFERENCES `Sequence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_benevoleId_fkey` FOREIGN KEY (`benevoleId`) REFERENCES `Benevole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

