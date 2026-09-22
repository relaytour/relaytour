-- Date du dernier résumé par organisation (ADR 0008). Colonne nullable : sans
-- valeur, le résumé suit dernierResumeLe, comme avant.
ALTER TABLE `PreferenceNotification` ADD COLUMN `derniersResumes` JSON NULL;
