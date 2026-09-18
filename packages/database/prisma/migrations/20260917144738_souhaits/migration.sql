-- CreateTable
CREATE TABLE `Souhait` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NOT NULL,
    `editionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Souhait_perimetreId_editionId_idx`(`perimetreId`, `editionId`),
    INDEX `Souhait_editionId_idx`(`editionId`),
    UNIQUE INDEX `Souhait_userId_perimetreId_editionId_key`(`userId`, `perimetreId`, `editionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Souhait` ADD CONSTRAINT `Souhait_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Souhait` ADD CONSTRAINT `Souhait_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Souhait` ADD CONSTRAINT `Souhait_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
