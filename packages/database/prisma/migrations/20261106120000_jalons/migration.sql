-- Jalons (ADR 0062). Migration additive : deux colonnes nulles sur Tache, une
-- colonne nulle sur Journal, quatre valeurs de TypeJournal et la table LienJalon.

-- AlterTable
ALTER TABLE `Tache` ADD COLUMN `jalonLe` DATETIME(3) NULL,
    ADD COLUMN `jalonParId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Journal` ADD COLUMN `tacheLieeId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE', 'DECLINAISON_PROPOSEE', 'DECLINAISON_ACCEPTEE', 'DECLINAISON_REFUSEE', 'DECLINAISON_IMPOSEE', 'DECLINAISON_RATTACHEE', 'DECLINAISON_DETACHEE', 'JALON_MARQUE', 'JALON_RETIRE', 'TACHE_LIEE', 'TACHE_DELIEE', 'FICHE_CONNEXE_MASQUEE', 'FICHE_CONNEXE_AFFICHEE', 'TACHE_PRIORITE') NOT NULL;

-- CreateTable
CREATE TABLE `LienJalon` (
    `id` VARCHAR(191) NOT NULL,
    `jalonId` VARCHAR(191) NOT NULL,
    `tacheId` VARCHAR(191) NOT NULL,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LienJalon_tacheId_idx`(`tacheId`),
    UNIQUE INDEX `LienJalon_jalonId_tacheId_key`(`jalonId`, `tacheId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Tache` ADD CONSTRAINT `Tache_jalonParId_fkey` FOREIGN KEY (`jalonParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LienJalon` ADD CONSTRAINT `LienJalon_jalonId_fkey` FOREIGN KEY (`jalonId`) REFERENCES `Tache`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LienJalon` ADD CONSTRAINT `LienJalon_tacheId_fkey` FOREIGN KEY (`tacheId`) REFERENCES `Tache`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LienJalon` ADD CONSTRAINT `LienJalon_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Journal` ADD CONSTRAINT `Journal_tacheLieeId_fkey` FOREIGN KEY (`tacheLieeId`) REFERENCES `Tache`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
