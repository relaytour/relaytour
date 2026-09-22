-- Activités d'une organisation et appartenances (ADR 0008), première étape.
-- Migration écrite à la main : Prisma recyclerait la table du journal pour la nouvelle
-- entité Activite et perdrait son contenu. Le journal change seulement de nom.
-- Colonnes nouvelles nullables ; la migration suivante les remplit, la troisième
-- les rend obligatoires (invariant 8).

-- ── Le journal Activite devient Journal ─────────────────────────────────────
-- Les clés étrangères et leurs index portent le nom de la table : ils sont retirés
-- puis recréés sous le nouveau nom, sans toucher aux lignes.
ALTER TABLE `Activite` DROP FOREIGN KEY `Activite_acteurId_fkey`;
ALTER TABLE `Activite` DROP FOREIGN KEY `Activite_editionId_fkey`;
ALTER TABLE `Activite` DROP FOREIGN KEY `Activite_ficheId_fkey`;
ALTER TABLE `Activite` DROP FOREIGN KEY `Activite_perimetreId_fkey`;
ALTER TABLE `Activite` DROP FOREIGN KEY `Activite_tacheId_fkey`;
DROP INDEX `Activite_ficheId_fkey` ON `Activite`;
DROP INDEX `Activite_perimetreId_fkey` ON `Activite`;
DROP INDEX `Activite_tacheId_fkey` ON `Activite`;

RENAME TABLE `Activite` TO `Journal`;

ALTER TABLE `Journal` RENAME INDEX `Activite_acteurId_createdAt_idx` TO `Journal_acteurId_createdAt_idx`;
ALTER TABLE `Journal` RENAME INDEX `Activite_editionId_perimetreId_createdAt_idx` TO `Journal_editionId_perimetreId_createdAt_idx`;

ALTER TABLE `Journal` ADD CONSTRAINT `Journal_acteurId_fkey` FOREIGN KEY (`acteurId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Journal` ADD CONSTRAINT `Journal_editionId_fkey` FOREIGN KEY (`editionId`) REFERENCES `Edition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Journal` ADD CONSTRAINT `Journal_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Journal` ADD CONSTRAINT `Journal_tacheId_fkey` FOREIGN KEY (`tacheId`) REFERENCES `Tache`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Journal` ADD CONSTRAINT `Journal_ficheId_fkey` FOREIGN KEY (`ficheId`) REFERENCES `Fiche`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Organisation : statut et limites ────────────────────────────────────────
ALTER TABLE `Organisation` ADD COLUMN `limites` JSON NULL,
    ADD COLUMN `statut` ENUM('ACTIVE', 'LECTURE_SEULE', 'SUSPENDUE', 'ARCHIVEE') NOT NULL DEFAULT 'ACTIVE';

-- ── Activités ────────────────────────────────────────────────────────────────
CREATE TABLE `Activite` (
    `id` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `sigle` VARCHAR(191) NULL,
    `nature` ENUM('EVENEMENT', 'SAISON', 'MANDAT') NOT NULL DEFAULT 'EVENEMENT',
    `groupes` JSON NOT NULL,
    `ordre` INTEGER NOT NULL DEFAULT 0,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Activite_organisationId_slug_key`(`organisationId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Activite` ADD CONSTRAINT `Activite_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Appartenances ────────────────────────────────────────────────────────────
CREATE TABLE `Appartenance` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'MEMBRE') NOT NULL DEFAULT 'MEMBRE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Appartenance_organisationId_idx`(`organisationId`),
    UNIQUE INDEX `Appartenance_userId_organisationId_key`(`userId`, `organisationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Appartenance` ADD CONSTRAINT `Appartenance_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Appartenance` ADD CONSTRAINT `Appartenance_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Clés d'activité et groupe de périmètre, nullables ───────────────────────
ALTER TABLE `Edition` ADD COLUMN `activiteId` VARCHAR(191) NULL;
ALTER TABLE `Fiche` ADD COLUMN `activiteId` VARCHAR(191) NULL;
ALTER TABLE `Perimetre` ADD COLUMN `activiteId` VARCHAR(191) NULL,
    ADD COLUMN `groupe` VARCHAR(191) NULL;

CREATE INDEX `Edition_activiteId_idx` ON `Edition`(`activiteId`);
CREATE INDEX `Fiche_activiteId_idx` ON `Fiche`(`activiteId`);
CREATE INDEX `Perimetre_activiteId_idx` ON `Perimetre`(`activiteId`);

ALTER TABLE `Edition` ADD CONSTRAINT `Edition_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Perimetre` ADD CONSTRAINT `Perimetre_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Fiche` ADD CONSTRAINT `Fiche_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
