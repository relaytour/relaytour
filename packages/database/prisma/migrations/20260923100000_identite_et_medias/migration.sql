-- Identité des activités, médias et source de vérité du contenu (ADR 0009).
-- Migration additive : des colonnes nullables et une table nouvelle.

-- AlterTable
ALTER TABLE `Organisation` ADD COLUMN `contenuModifieLe` DATETIME(3) NULL,
    ADD COLUMN `contenuSynchroniseLe` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Activite` ADD COLUMN `identite` JSON NULL;

-- AlterTable
ALTER TABLE `Perimetre` ADD COLUMN `effectifParDefaut` INTEGER NULL,
    ADD COLUMN `tachesTypes` JSON NULL;

-- CreateTable
CREATE TABLE `Media` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `empreinte` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `octets` INTEGER NOT NULL,
    `donnees` MEDIUMBLOB NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Media_empreinte_idx`(`empreinte`),
    UNIQUE INDEX `Media_organisationId_empreinte_key`(`organisationId`, `empreinte`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Media` ADD CONSTRAINT `Media_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

