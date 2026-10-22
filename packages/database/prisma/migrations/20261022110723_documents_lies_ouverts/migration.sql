-- AlterTable
ALTER TABLE `RessourceFiche` ADD COLUMN `ouverteAuxLecteurs` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ouverteLe` DATETIME(3) NULL,
    ADD COLUMN `ouverteParId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `RessourceFiche` ADD CONSTRAINT `RessourceFiche_ouverteParId_fkey` FOREIGN KEY (`ouverteParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
