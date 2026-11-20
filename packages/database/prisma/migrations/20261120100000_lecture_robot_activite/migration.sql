-- Lecture d'une activité par un robot (ADR 0069). Migration additive : une
-- version antérieure ignore la colonne, et le robot retombe en découverte.
ALTER TABLE `RattachementActivite` ADD COLUMN `lecture` BOOLEAN NOT NULL DEFAULT false;
