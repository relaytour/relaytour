-- Périodes de travail des tâches (ADR 0068). Migration additive : une colonne nulle
-- sur Tache. Aucune tâche existante ne reçoit de durée.

-- AlterTable
ALTER TABLE `Tache` ADD COLUMN `duree` ENUM('QUELQUES_JOURS', 'DEUX_A_TROIS_SEMAINES', 'UN_A_DEUX_MOIS', 'DEUX_A_TROIS_MOIS') NULL;
