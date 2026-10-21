-- AlterTable
ALTER TABLE `FicheVersion` MODIFY `source` ENUM('GIT', 'APP', 'ESPACE_FICHIERS') NOT NULL;
