-- Admins d'une activité (ADR 0010). Migration additive : une table nouvelle.

-- CreateTable
CREATE TABLE `AdminActivite` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `nommeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminActivite_organisationId_idx`(`organisationId`),
    INDEX `AdminActivite_activiteId_idx`(`activiteId`),
    UNIQUE INDEX `AdminActivite_userId_activiteId_key`(`userId`, `activiteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminActivite` ADD CONSTRAINT `AdminActivite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminActivite` ADD CONSTRAINT `AdminActivite_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminActivite` ADD CONSTRAINT `AdminActivite_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

