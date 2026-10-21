-- AlterTable
ALTER TABLE `ConnexionFichiers` MODIFY `fournisseur` ENUM('SHAREPOINT', 'GOOGLE_DRIVE', 'DROPBOX') NOT NULL;

-- AlterTable
ALTER TABLE `DossierLie` MODIFY `fournisseur` ENUM('SHAREPOINT', 'GOOGLE_DRIVE', 'DROPBOX') NOT NULL;
