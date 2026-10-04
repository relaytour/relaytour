-- AlterTable
ALTER TABLE `Activite` ADD COLUMN `formulaire` JSON NULL,
    ADD COLUMN `formulaireOuvert` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Demande` ADD COLUMN `disponibilite` VARCHAR(191) NULL,
    ADD COLUMN `question` VARCHAR(191) NULL,
    ADD COLUMN `reponse` VARCHAR(191) NULL,
    ADD COLUMN `texte` VARCHAR(600) NULL;
