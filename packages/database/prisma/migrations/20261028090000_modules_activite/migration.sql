-- AlterTable
ALTER TABLE `Activite` ADD COLUMN `modules` JSON NULL;

-- AlterTable
ALTER TABLE `Organisation` ADD COLUMN `modulesAutorises` JSON NULL;
