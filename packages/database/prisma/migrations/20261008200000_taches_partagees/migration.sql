-- AlterTable
ALTER TABLE `Tache` ADD COLUMN `accord` ENUM('EN_ATTENTE', 'ACCEPTE', 'REFUSE') NULL,
    ADD COLUMN `accordLe` DATETIME(3) NULL,
    ADD COLUMN `accordParId` VARCHAR(191) NULL,
    ADD COLUMN `origineId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Tache_origineId_perimetreId_key` ON `Tache`(`origineId`, `perimetreId`);

-- AddForeignKey
ALTER TABLE `Tache` ADD CONSTRAINT `Tache_origineId_fkey` FOREIGN KEY (`origineId`) REFERENCES `Tache`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tache` ADD CONSTRAINT `Tache_accordParId_fkey` FOREIGN KEY (`accordParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

