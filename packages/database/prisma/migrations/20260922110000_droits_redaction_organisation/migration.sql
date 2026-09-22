-- Clé d'organisation du droit de rédaction (ADR 0008).
-- Un droit sans périmètre vaut pour toutes les fiches : sans cette clé, il vaudrait
-- pour toutes les organisations de l'installation. Colonne nullable, remplie, puis
-- obligatoire (invariant 8).

ALTER TABLE `DroitRedaction` ADD COLUMN `organisationId` VARCHAR(191) NULL;

-- Un droit de périmètre suit l'organisation du périmètre.
UPDATE `DroitRedaction` d
JOIN `Perimetre` p ON p.`id` = d.`perimetreId`
SET d.`organisationId` = p.`organisationId`
WHERE d.`organisationId` IS NULL;

-- Un droit global suit la première organisation dont la personne est membre, sinon
-- la première organisation de l'installation.
UPDATE `DroitRedaction` d
SET d.`organisationId` = COALESCE(
    (SELECT ap.`organisationId` FROM `Appartenance` ap WHERE ap.`userId` = d.`userId` ORDER BY ap.`createdAt`, ap.`id` LIMIT 1),
    (SELECT o.`id` FROM `Organisation` o ORDER BY o.`createdAt`, o.`id` LIMIT 1)
)
WHERE d.`organisationId` IS NULL;

ALTER TABLE `DroitRedaction` MODIFY `organisationId` VARCHAR(191) NOT NULL;

CREATE INDEX `DroitRedaction_organisationId_idx` ON `DroitRedaction`(`organisationId`);

ALTER TABLE `DroitRedaction` ADD CONSTRAINT `DroitRedaction_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
