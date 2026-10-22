-- AlterTable
ALTER TABLE `DossierLie` ADD COLUMN `accesFournisseur` ENUM('AUCUN', 'PARTAGE', 'GROUPE') NOT NULL DEFAULT 'AUCUN',
    ADD COLUMN `ajoutsAutomatiques` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `groupeFournisseurId` VARCHAR(255) NULL,
    ADD COLUMN `groupeFournisseurNom` VARCHAR(255) NULL,
    ADD COLUMN `invitationFournisseur` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `roleFournisseur` ENUM('LECTURE', 'ECRITURE') NOT NULL DEFAULT 'LECTURE';

-- AlterTable
ALTER TABLE `Notification` MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'ECHEANCE_PROCHE', 'TACHE_EN_RETARD', 'DEMANDE_RECUE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE', 'DECLINAISON_PROPOSEE', 'DECLINAISON_ACCEPTEE', 'DECLINAISON_REFUSEE', 'TACHE_COMMENTEE', 'INVITATION_ACCEPTEE', 'AFFECTATION_AJOUTEE', 'AFFECTATION_RETIREE', 'SOUHAIT_FORMULE', 'DEMANDE_ACCEPTEE', 'DEMANDE_REFUSEE', 'ADMIN_ACTIVITE_NOMME', 'ADMIN_ACTIVITE_RETIRE', 'ADMIN_ORGANISATION_NOMME', 'ADMIN_ORGANISATION_RETIRE', 'PERSONNE_ARCHIVEE', 'PERSONNE_RETABLIE', 'PLACE_MODIFIEE', 'REUNION_CONVOQUEE', 'REUNION_MODIFIEE', 'REUNION_ANNULEE', 'SONDAGE_OUVERT', 'FICHE_CONNEXE', 'CANDIDATURE_RECUE', 'BENEVOLE_RETIRE', 'ACCES_FOURNISSEUR_A_VALIDER') NOT NULL;

-- CreateTable
CREATE TABLE `PropositionAcces` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `dossierLieId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `action` ENUM('AJOUTER', 'RETIRER') NOT NULL,
    `etat` ENUM('EN_ATTENTE', 'APPLIQUEE', 'ECARTEE', 'ECHEC') NOT NULL DEFAULT 'EN_ATTENTE',
    `erreur` VARCHAR(255) NULL,
    `creeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `traiteeParId` VARCHAR(191) NULL,
    `traiteeLe` DATETIME(3) NULL,

    INDEX `PropositionAcces_organisationId_dossierLieId_etat_idx`(`organisationId`, `dossierLieId`, `etat`),
    INDEX `PropositionAcces_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermissionCreee` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `dossierLieId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `identifiant` VARCHAR(255) NOT NULL,
    `creeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PermissionCreee_organisationId_idx`(`organisationId`),
    INDEX `PermissionCreee_userId_idx`(`userId`),
    UNIQUE INDEX `PermissionCreee_dossierLieId_userId_key`(`dossierLieId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PropositionAcces` ADD CONSTRAINT `PropositionAcces_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropositionAcces` ADD CONSTRAINT `PropositionAcces_dossierLieId_fkey` FOREIGN KEY (`dossierLieId`) REFERENCES `DossierLie`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropositionAcces` ADD CONSTRAINT `PropositionAcces_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropositionAcces` ADD CONSTRAINT `PropositionAcces_traiteeParId_fkey` FOREIGN KEY (`traiteeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermissionCreee` ADD CONSTRAINT `PermissionCreee_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermissionCreee` ADD CONSTRAINT `PermissionCreee_dossierLieId_fkey` FOREIGN KEY (`dossierLieId`) REFERENCES `DossierLie`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermissionCreee` ADD CONSTRAINT `PermissionCreee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
