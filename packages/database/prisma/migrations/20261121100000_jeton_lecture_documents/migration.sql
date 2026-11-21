-- Lecture du texte d'un document par un jeton (ADR 0072). Migration additive : la
-- colonne vaut faux par défaut, les jetons existants ne lisent aucun texte, et une
-- version antérieure ignore la colonne.
-- AlterTable
ALTER TABLE `JetonAcces` ADD COLUMN `lectureDocuments` BOOLEAN NOT NULL DEFAULT false;
