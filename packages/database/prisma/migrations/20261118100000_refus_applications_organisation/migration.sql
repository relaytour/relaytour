-- AlterTable
ALTER TABLE `JetonAcces` ADD COLUMN `rappelFinLe` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Organisation` ADD COLUMN `applicationsAutorisees` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `ApplicationRefusee` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(512) NOT NULL,
    `parId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApplicationRefusee_parId_idx`(`parId`),
    UNIQUE INDEX `ApplicationRefusee_organisationId_clientId_key`(`organisationId`, `clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApplicationRefusee` ADD CONSTRAINT `ApplicationRefusee_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationRefusee` ADD CONSTRAINT `ApplicationRefusee_parId_fkey` FOREIGN KEY (`parId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

