-- AlterTable
ALTER TABLE `JetonAcces` ADD COLUMN `gestionMembres` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `revoqueParId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `JetonAcces_revoqueParId_idx` ON `JetonAcces`(`revoqueParId`);

-- AddForeignKey
ALTER TABLE `JetonAcces` ADD CONSTRAINT `JetonAcces_revoqueParId_fkey` FOREIGN KEY (`revoqueParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

