-- AlterTable
ALTER TABLE `Edition` ADD COLUMN `organisationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Fiche` ADD COLUMN `organisationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `organisationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Perimetre` ADD COLUMN `organisationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PreferenceNotification` ADD COLUMN `organisationId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Organisation` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `sigle` VARCHAR(191) NULL,
    `fuseauHoraire` VARCHAR(191) NOT NULL DEFAULT 'Europe/Paris',
    `configuration` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Organisation_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Edition_organisationId_idx` ON `Edition`(`organisationId`);

-- CreateIndex
CREATE INDEX `Fiche_organisationId_idx` ON `Fiche`(`organisationId`);

-- CreateIndex
CREATE INDEX `Notification_organisationId_idx` ON `Notification`(`organisationId`);

-- CreateIndex
CREATE INDEX `Perimetre_organisationId_idx` ON `Perimetre`(`organisationId`);

-- CreateIndex
CREATE INDEX `PreferenceNotification_organisationId_idx` ON `PreferenceNotification`(`organisationId`);

-- AddForeignKey
ALTER TABLE `Edition` ADD CONSTRAINT `Edition_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Perimetre` ADD CONSTRAINT `Perimetre_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fiche` ADD CONSTRAINT `Fiche_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreferenceNotification` ADD CONSTRAINT `PreferenceNotification_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
