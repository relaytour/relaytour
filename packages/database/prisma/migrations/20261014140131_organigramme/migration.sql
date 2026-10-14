-- AlterTable
ALTER TABLE `Activite` ADD COLUMN `adressesOrganigramme` ENUM('AUCUNE', 'CONTACTS', 'REFERENTS') NOT NULL DEFAULT 'AUCUNE';

-- AlterTable
ALTER TABLE `Appartenance` ADD COLUMN `adresseVisible` BOOLEAN NOT NULL DEFAULT false;
