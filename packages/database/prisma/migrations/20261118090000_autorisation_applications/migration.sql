-- AlterTable
ALTER TABLE `JetonAcces` ADD COLUMN `clientApplicationId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ClientApplication` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(512) NOT NULL,
    `source` ENUM('CIMD', 'DCR') NOT NULL,
    `nom` VARCHAR(80) NOT NULL,
    `redirectUris` JSON NOT NULL,
    `valideJusquau` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClientApplication_clientId_key`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DemandeAutorisation` (
    `id` VARCHAR(43) NOT NULL,
    `clientApplicationId` VARCHAR(191) NOT NULL,
    `redirectUri` VARCHAR(512) NOT NULL,
    `portees` VARCHAR(40) NOT NULL,
    `state` VARCHAR(512) NULL,
    `codeChallenge` CHAR(43) NOT NULL,
    `expireLe` DATETIME(3) NOT NULL,
    `reponduLe` DATETIME(3) NULL,
    `jetonAccesId` VARCHAR(191) NULL,
    `codeEmpreinte` CHAR(64) NULL,
    `codeExpireLe` DATETIME(3) NULL,
    `codeUtiliseLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DemandeAutorisation_jetonAccesId_key`(`jetonAccesId`),
    UNIQUE INDEX `DemandeAutorisation_codeEmpreinte_key`(`codeEmpreinte`),
    INDEX `DemandeAutorisation_clientApplicationId_idx`(`clientApplicationId`),
    INDEX `DemandeAutorisation_expireLe_idx`(`expireLe`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JetonApplication` (
    `id` VARCHAR(191) NOT NULL,
    `jetonAccesId` VARCHAR(191) NOT NULL,
    `sorte` ENUM('ACCES', 'RENOUVELLEMENT') NOT NULL,
    `empreinte` CHAR(64) NOT NULL,
    `expireLe` DATETIME(3) NOT NULL,
    `utiliseLe` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `JetonApplication_empreinte_key`(`empreinte`),
    INDEX `JetonApplication_jetonAccesId_idx`(`jetonAccesId`),
    INDEX `JetonApplication_expireLe_idx`(`expireLe`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `JetonAcces_clientApplicationId_idx` ON `JetonAcces`(`clientApplicationId`);

-- AddForeignKey
ALTER TABLE `JetonAcces` ADD CONSTRAINT `JetonAcces_clientApplicationId_fkey` FOREIGN KEY (`clientApplicationId`) REFERENCES `ClientApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemandeAutorisation` ADD CONSTRAINT `DemandeAutorisation_clientApplicationId_fkey` FOREIGN KEY (`clientApplicationId`) REFERENCES `ClientApplication`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DemandeAutorisation` ADD CONSTRAINT `DemandeAutorisation_jetonAccesId_fkey` FOREIGN KEY (`jetonAccesId`) REFERENCES `JetonAcces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JetonApplication` ADD CONSTRAINT `JetonApplication_jetonAccesId_fkey` FOREIGN KEY (`jetonAccesId`) REFERENCES `JetonAcces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

