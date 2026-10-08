-- AlterTable
ALTER TABLE `PreferenceNotification` ADD COLUMN `pushDemandes` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `pushEcheances` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `pushTaches` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `AbonnementPush` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `empreinte` CHAR(64) NOT NULL,
    `adresse` TEXT NOT NULL,
    `p256dh` VARCHAR(255) NOT NULL,
    `auth` VARCHAR(255) NOT NULL,
    `appareil` VARCHAR(60) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AbonnementPush_userId_empreinte_key`(`userId`, `empreinte`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AbonnementPush` ADD CONSTRAINT `AbonnementPush_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
