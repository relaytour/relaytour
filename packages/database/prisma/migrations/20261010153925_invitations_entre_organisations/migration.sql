-- AlterTable
ALTER TABLE `Notification` MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'ECHEANCE_PROCHE', 'TACHE_EN_RETARD', 'DEMANDE_RECUE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE', 'DECLINAISON_PROPOSEE', 'DECLINAISON_ACCEPTEE', 'DECLINAISON_REFUSEE', 'TACHE_COMMENTEE', 'INVITATION_ACCEPTEE') NOT NULL;

-- CreateTable
CREATE TABLE `InvitationOrganisation` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'MEMBRE') NOT NULL DEFAULT 'MEMBRE',
    `nom` VARCHAR(191) NOT NULL,
    `origine` ENUM('PERSONNE', 'IMPORT', 'INSTALLATION') NOT NULL,
    `inviteParId` VARCHAR(191) NULL,
    `globale` BOOLEAN NOT NULL DEFAULT false,
    `lots` JSON NOT NULL,
    `expireLe` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InvitationOrganisation_userId_idx`(`userId`),
    INDEX `InvitationOrganisation_inviteParId_idx`(`inviteParId`),
    UNIQUE INDEX `InvitationOrganisation_organisationId_userId_key`(`organisationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InvitationOrganisation` ADD CONSTRAINT `InvitationOrganisation_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvitationOrganisation` ADD CONSTRAINT `InvitationOrganisation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvitationOrganisation` ADD CONSTRAINT `InvitationOrganisation_inviteParId_fkey` FOREIGN KEY (`inviteParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
