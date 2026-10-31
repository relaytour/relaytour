-- AlterTable
ALTER TABLE `AbonnementAgenda` ADD COLUMN `inclurePhases` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `inclureDatesCles` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `inclureReunions` BOOLEAN NOT NULL DEFAULT true;

-- Les abonnements existants gardent leur contenu : `inclureGlobal` couvrait les
-- phases, les dates clés et les réunions de l'activité.
UPDATE `AbonnementAgenda`
SET `inclurePhases` = `inclureGlobal`,
    `inclureDatesCles` = `inclureGlobal`,
    `inclureReunions` = `inclureGlobal`;
