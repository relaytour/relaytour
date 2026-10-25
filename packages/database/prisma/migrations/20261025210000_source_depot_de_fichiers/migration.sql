-- AlterTable
ALTER TABLE `FicheVersion` MODIFY `source` ENUM('GIT', 'APP', 'ESPACE_FICHIERS', 'DEPOT') NOT NULL;
