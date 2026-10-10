-- AlterTable
ALTER TABLE `Notification` MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'ECHEANCE_PROCHE', 'TACHE_EN_RETARD', 'DEMANDE_RECUE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE', 'DECLINAISON_PROPOSEE', 'DECLINAISON_ACCEPTEE', 'DECLINAISON_REFUSEE', 'TACHE_COMMENTEE') NOT NULL;

-- CreateTable
CREATE TABLE `CommentaireTache` (
    `id` VARCHAR(191) NOT NULL,
    `tacheId` VARCHAR(191) NOT NULL,
    `auteurId` VARCHAR(191) NULL,
    `texte` TEXT NOT NULL,
    `modifieLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommentaireTache_tacheId_createdAt_idx`(`tacheId`, `createdAt`),
    INDEX `CommentaireTache_auteurId_idx`(`auteurId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CommentaireTache` ADD CONSTRAINT `CommentaireTache_tacheId_fkey` FOREIGN KEY (`tacheId`) REFERENCES `Tache`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommentaireTache` ADD CONSTRAINT `CommentaireTache_auteurId_fkey` FOREIGN KEY (`auteurId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
