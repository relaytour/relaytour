-- Clés d'activité obligatoires et contraintes d'unicité par activité (ADR 0008),
-- troisième étape. La migration précédente a rempli chaque ligne : une valeur nulle
-- restante fait échouer la migration ici, avant toute perte.
--
-- Trois contraintes globales s'élargissent : l'année d'une période devient unique par
-- activité, le slug d'un périmètre par activité, le slug d'une fiche par organisation.
-- C'est l'assouplissement prévu par l'ADR 0006 ; aucune donnée ne change de sens.
--
-- Les lignes MODIFY sur les colonnes JSON que Prisma propose ici sont omises : elles
-- traduisent une particularité de MariaDB déjà présente avant cette migration.

ALTER TABLE `Edition` DROP FOREIGN KEY `Edition_activiteId_fkey`;
ALTER TABLE `Fiche` DROP FOREIGN KEY `Fiche_activiteId_fkey`;
ALTER TABLE `Perimetre` DROP FOREIGN KEY `Perimetre_activiteId_fkey`;

DROP INDEX `Edition_activiteId_idx` ON `Edition`;
DROP INDEX `Edition_annee_key` ON `Edition`;
DROP INDEX `Fiche_slug_key` ON `Fiche`;
DROP INDEX `Perimetre_activiteId_idx` ON `Perimetre`;
DROP INDEX `Perimetre_slug_key` ON `Perimetre`;

ALTER TABLE `Edition` MODIFY `activiteId` VARCHAR(191) NOT NULL;
ALTER TABLE `Fiche` MODIFY `activiteId` VARCHAR(191) NOT NULL;
ALTER TABLE `Perimetre` MODIFY `activiteId` VARCHAR(191) NOT NULL,
    MODIFY `groupe` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `Edition_activiteId_annee_key` ON `Edition`(`activiteId`, `annee`);
CREATE UNIQUE INDEX `Fiche_organisationId_slug_key` ON `Fiche`(`organisationId`, `slug`);
CREATE UNIQUE INDEX `Perimetre_activiteId_slug_key` ON `Perimetre`(`activiteId`, `slug`);

ALTER TABLE `Edition` ADD CONSTRAINT `Edition_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Perimetre` ADD CONSTRAINT `Perimetre_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Fiche` ADD CONSTRAINT `Fiche_activiteId_fkey` FOREIGN KEY (`activiteId`) REFERENCES `Activite`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
