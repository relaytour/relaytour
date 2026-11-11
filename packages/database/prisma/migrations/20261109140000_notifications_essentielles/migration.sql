-- Notifications essentielles et modèles de réglages (ADR 0065).

-- AlterTable
ALTER TABLE `PreferenceOrganisation` ADD COLUMN `suiviPerimetres` ENUM('MOI', 'SUIVI', 'DETAIL') NOT NULL DEFAULT 'MOI',
    ADD COLUMN `detailContactPrincipal` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `suiviAdmin` ENUM('ACTIONS', 'DETAIL') NOT NULL DEFAULT 'ACTIONS',
    MODIFY `mailPriorites` ENUM('AUCUN', 'MES_PERIMETRES', 'ACTIVITE') NOT NULL DEFAULT 'MES_PERIMETRES';

-- Rattrapage unique : chaque membre actif reçoit le modèle de son rôle du jour.
-- Les colonnes ajoutées valent déjà le modèle Essentiel pour toutes les lignes.

-- Les membres actifs sans ligne de préférences en reçoivent une, aux valeurs par défaut
-- d'avant cette migration, pour que le rattrapage les règle comme les autres.
INSERT INTO `PreferenceOrganisation` (`userId`, `organisationId`, `mailPriorites`, `updatedAt`)
SELECT `a`.`userId`, `a`.`organisationId`, 'AUCUN', NOW(3)
FROM `Appartenance` `a`
LEFT JOIN `PreferenceOrganisation` `p`
  ON `p`.`userId` = `a`.`userId` AND `p`.`organisationId` = `a`.`organisationId`
WHERE `a`.`archiveLe` IS NULL AND `p`.`userId` IS NULL;

-- Les admins de l'organisation ou d'une activité.
CREATE TEMPORARY TABLE `rattrapage_admins` (
  `userId` VARCHAR(191) NOT NULL,
  `organisationId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`userId`, `organisationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT IGNORE INTO `rattrapage_admins` (`userId`, `organisationId`)
SELECT `userId`, `organisationId` FROM `Appartenance`
WHERE `role` = 'ADMIN' AND `archiveLe` IS NULL;
INSERT IGNORE INTO `rattrapage_admins` (`userId`, `organisationId`)
SELECT `aa`.`userId`, `aa`.`organisationId` FROM `AdminActivite` `aa`
JOIN `Appartenance` `a`
  ON `a`.`userId` = `aa`.`userId` AND `a`.`organisationId` = `aa`.`organisationId`
WHERE `a`.`archiveLe` IS NULL;

-- Les contacts principaux d'une période non archivée.
CREATE TEMPORARY TABLE `rattrapage_contacts` (
  `userId` VARCHAR(191) NOT NULL,
  `organisationId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`userId`, `organisationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT IGNORE INTO `rattrapage_contacts` (`userId`, `organisationId`)
SELECT `af`.`userId`, `pe`.`organisationId` FROM `Affectation` `af`
JOIN `Perimetre` `pe` ON `pe`.`id` = `af`.`perimetreId`
JOIN `Edition` `e` ON `e`.`id` = `af`.`editionId`
JOIN `Appartenance` `a`
  ON `a`.`userId` = `af`.`userId` AND `a`.`organisationId` = `pe`.`organisationId`
WHERE `af`.`contactPrincipal` = true AND `e`.`statut` <> 'ARCHIVEE' AND `a`.`archiveLe` IS NULL;

-- Le mail des priorités prend la valeur du modèle quand la ligne gardait les défauts
-- d'avant : résumé hebdomadaire et aucun mail des priorités. Un mail coupé reste coupé.
UPDATE `PreferenceOrganisation` `p`
JOIN `rattrapage_admins` `r`
  ON `r`.`userId` = `p`.`userId` AND `r`.`organisationId` = `p`.`organisationId`
SET `p`.`mailPriorites` = 'ACTIVITE'
WHERE `p`.`mailPriorites` = 'AUCUN' AND `p`.`frequenceResume` = 'HEBDOMADAIRE';

UPDATE `PreferenceOrganisation` `p`
SET `p`.`mailPriorites` = 'MES_PERIMETRES'
WHERE `p`.`mailPriorites` = 'AUCUN' AND `p`.`frequenceResume` = 'HEBDOMADAIRE';

-- Modèle Contact principal. Le résumé hebdomadaire passe à chaque jour ; un résumé
-- coupé reste coupé.
UPDATE `PreferenceOrganisation` `p`
JOIN `rattrapage_contacts` `r`
  ON `r`.`userId` = `p`.`userId` AND `r`.`organisationId` = `p`.`organisationId`
SET `p`.`suiviPerimetres` = 'SUIVI', `p`.`detailContactPrincipal` = true,
    `p`.`frequenceResume` = IF(`p`.`frequenceResume` = 'HEBDOMADAIRE', 'QUOTIDIEN', `p`.`frequenceResume`);

-- Modèle Admin d'activité : le rôle le plus large l'emporte. Le push de l'équipe
-- s'ouvre ; il ne part que vers les appareils où la personne a activé le push.
UPDATE `PreferenceOrganisation` `p`
JOIN `rattrapage_admins` `r`
  ON `r`.`userId` = `p`.`userId` AND `r`.`organisationId` = `p`.`organisationId`
SET `p`.`suiviPerimetres` = 'SUIVI', `p`.`detailContactPrincipal` = false, `p`.`suiviAdmin` = 'DETAIL',
    `p`.`pushEquipe` = true,
    `p`.`frequenceResume` = IF(`p`.`frequenceResume` = 'HEBDOMADAIRE', 'QUOTIDIEN', `p`.`frequenceResume`);

DROP TEMPORARY TABLE `rattrapage_contacts`;
DROP TEMPORARY TABLE `rattrapage_admins`;
