-- CreateTable
CREATE TABLE `EffectifPerimetre` (
    `id` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `effectif` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EffectifPerimetre_editionId_idx`(`editionId`),
    UNIQUE INDEX `EffectifPerimetre_perimetreId_editionId_key`(`perimetreId`, `editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EffectifPerimetre` ADD CONSTRAINT `EffectifPerimetre_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EffectifPerimetre` ADD CONSTRAINT `EffectifPerimetre_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
