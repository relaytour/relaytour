-- AlterTable
ALTER TABLE `ConnexionFichiers` ADD COLUMN `accesErreur` VARCHAR(255) NULL,
    ADD COLUMN `accesVerifieLe` DATETIME(3) NULL,
    ADD COLUMN `portee` ENUM('FICHIERS', 'ANNUAIRE', 'GESTION') NOT NULL DEFAULT 'FICHIERS';

-- AlterTable
ALTER TABLE `DossierLie` ADD COLUMN `attendus` ENUM('MEMBRES', 'CONTACTS_PRINCIPAUX') NOT NULL DEFAULT 'MEMBRES';

-- CreateTable
CREATE TABLE `CompteFournisseur` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fournisseur` ENUM('SHAREPOINT', 'GOOGLE_DRIVE', 'DROPBOX', 'NEXTCLOUD') NOT NULL,
    `adresseSaisie` VARCHAR(320) NULL,
    `etat` ENUM('TROUVE', 'INVITE', 'ABSENT') NOT NULL DEFAULT 'ABSENT',
    `identifiant` VARCHAR(255) NULL,
    `verifieLe` DATETIME(3) NULL,

    INDEX `CompteFournisseur_userId_idx`(`userId`),
    UNIQUE INDEX `CompteFournisseur_organisationId_fournisseur_userId_key`(`organisationId`, `fournisseur`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EtatAccesDossier` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `dossierLieId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `nom` VARCHAR(255) NULL,
    `etat` ENUM('A_ACCES', 'SANS_COMPTE', 'SANS_ACCES', 'INCONNU', 'EN_TROP') NOT NULL,
    `via` VARCHAR(255) NULL,
    `verifieLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EtatAccesDossier_organisationId_dossierLieId_idx`(`organisationId`, `dossierLieId`),
    INDEX `EtatAccesDossier_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CompteFournisseur` ADD CONSTRAINT `CompteFournisseur_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompteFournisseur` ADD CONSTRAINT `CompteFournisseur_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EtatAccesDossier` ADD CONSTRAINT `EtatAccesDossier_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EtatAccesDossier` ADD CONSTRAINT `EtatAccesDossier_dossierLieId_fkey` FOREIGN KEY (`dossierLieId`) REFERENCES `DossierLie`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EtatAccesDossier` ADD CONSTRAINT `EtatAccesDossier_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
