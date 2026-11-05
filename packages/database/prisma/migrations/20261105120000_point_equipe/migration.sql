-- AlterTable
ALTER TABLE `Reunion` ADD COLUMN `pointEquipe` BOOLEAN NOT NULL DEFAULT false;

-- Les réunions globales à venir qui convoquent toute l'équipe gardent leur effet
-- sur l'horizon des priorités (ADR 0059).
UPDATE `Reunion`
SET `pointEquipe` = true
WHERE `perimetreId` IS NULL
  AND `cible` = 'EQUIPE'
  AND `statut` = 'PREVUE'
  AND `debut` > CURRENT_TIMESTAMP(3);
