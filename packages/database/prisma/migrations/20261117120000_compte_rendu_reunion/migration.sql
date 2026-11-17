-- AlterTable
ALTER TABLE `Reunion` ADD COLUMN `compteRenduFicheId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Reunion_compteRenduFicheId_idx` ON `Reunion`(`compteRenduFicheId`);

-- AddForeignKey
ALTER TABLE `Reunion` ADD CONSTRAINT `Reunion_compteRenduFicheId_fkey` FOREIGN KEY (`compteRenduFicheId`) REFERENCES `Fiche`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
