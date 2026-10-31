-- Personnes réalisatrices d'une tâche faite (ADR 0055). Migration additive :
-- `Tache.realiseeParId` reste en place, sans lecture ni écriture, jusqu'à une
-- migration de suppression distincte.

-- CreateTable
CREATE TABLE `TacheRealisation` (
    `id` VARCHAR(191) NOT NULL,
    `tacheId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TacheRealisation_userId_idx`(`userId`),
    UNIQUE INDEX `TacheRealisation_tacheId_userId_key`(`tacheId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TacheRealisation` ADD CONSTRAINT `TacheRealisation_tacheId_fkey` FOREIGN KEY (`tacheId`) REFERENCES `Tache`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TacheRealisation` ADD CONSTRAINT `TacheRealisation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Recopie de la personne réalisatrice unique des tâches faites. Une tâche qui n'est
-- plus faite ne garde aucune personne réalisatrice.
INSERT IGNORE INTO `TacheRealisation` (`id`, `tacheId`, `userId`, `createdAt`)
SELECT
    CONCAT('rea_', MD5(CONCAT(t.`id`, '-', t.`realiseeParId`))),
    t.`id`,
    t.`realiseeParId`,
    COALESCE(t.`termineeLe`, t.`updatedAt`)
FROM `Tache` t
WHERE t.`realiseeParId` IS NOT NULL AND t.`statut` = 'FAITE';
