-- AlterTable
ALTER TABLE `InvitationOrganisation` ADD COLUMN `rattachements` JSON NULL;

-- CreateTable
CREATE TABLE `RattachementActivite` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `activiteId` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `creeParId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RattachementActivite_organisationId_idx`(`organisationId`),
    INDEX `RattachementActivite_activiteId_idx`(`activiteId`),
    INDEX `RattachementActivite_creeParId_idx`(`creeParId`),
    UNIQUE INDEX `RattachementActivite_userId_activiteId_key`(`userId`, `activiteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RattachementActivite` ADD CONSTRAINT `RattachementActivite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RattachementActivite` ADD CONSTRAINT `RattachementActivite_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RattachementActivite` ADD CONSTRAINT `RattachementActivite_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RattachementActivite` ADD CONSTRAINT `RattachementActivite_creeParId_fkey` FOREIGN KEY (`creeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise (ADR 0045) : chaque personne est rattachée à chaque activité où elle a
-- au moins une affectation, toutes périodes confondues, puis à l'activité de
-- chaque demande acceptée qui a lié son compte. L'identifiant se déduit de la
-- personne et de l'activité : la reprise ne crée aucun doublon.
INSERT IGNORE INTO `RattachementActivite` (`id`, `userId`, `activiteId`, `organisationId`, `createdAt`)
SELECT
    CONCAT('rat_', MD5(CONCAT(a.`userId`, '-', p.`activiteId`))),
    a.`userId`,
    p.`activiteId`,
    p.`organisationId`,
    MIN(a.`createdAt`)
FROM `Affectation` a
JOIN `Perimetre` p ON p.`id` = a.`perimetreId`
GROUP BY a.`userId`, p.`activiteId`, p.`organisationId`;

INSERT IGNORE INTO `RattachementActivite` (`id`, `userId`, `activiteId`, `organisationId`, `createdAt`)
SELECT
    CONCAT('rat_', MD5(CONCAT(d.`userId`, '-', d.`activiteId`))),
    d.`userId`,
    d.`activiteId`,
    d.`organisationId`,
    MIN(COALESCE(d.`traiteeLe`, d.`createdAt`))
FROM `Demande` d
WHERE d.`statut` = 'ACCEPTEE' AND d.`userId` IS NOT NULL
GROUP BY d.`userId`, d.`activiteId`, d.`organisationId`;
