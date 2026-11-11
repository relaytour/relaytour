-- Fenêtre de regroupement des notifications de tâche (ADR 0065).

-- AlterTable
ALTER TABLE `Journal` ADD COLUMN `statutPrecedent` ENUM('A_FAIRE', 'EN_COURS', 'FAITE', 'ABANDONNEE') NULL;

-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `disponibleLe` DATETIME(3) NULL,
    ADD COLUMN `mailEnAttente` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Notification_tacheId_disponibleLe_idx` ON `Notification`(`tacheId`, `disponibleLe`);
