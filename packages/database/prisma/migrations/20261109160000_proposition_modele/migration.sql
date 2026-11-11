-- Proposition du modèle de notifications du rôle (ADR 0065).

-- AlterTable
ALTER TABLE `PreferenceOrganisation` ADD COLUMN `modeleEcarte` ENUM('ESSENTIEL', 'REFERENT', 'CONTACT_PRINCIPAL', 'ADMIN_ACTIVITE') NULL;
