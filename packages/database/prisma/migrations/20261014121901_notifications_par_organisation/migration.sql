-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `editionId` VARCHAR(191) NULL,
    ADD COLUMN `niveau` ENUM('REFERENT', 'ADMIN_ACTIVITE', 'ADMIN_ORGANISATION') NOT NULL DEFAULT 'REFERENT',
    MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'ECHEANCE_PROCHE', 'TACHE_EN_RETARD', 'DEMANDE_RECUE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE', 'DECLINAISON_PROPOSEE', 'DECLINAISON_ACCEPTEE', 'DECLINAISON_REFUSEE', 'TACHE_COMMENTEE', 'INVITATION_ACCEPTEE', 'AFFECTATION_AJOUTEE', 'AFFECTATION_RETIREE', 'SOUHAIT_FORMULE', 'DEMANDE_ACCEPTEE', 'DEMANDE_REFUSEE', 'ADMIN_ACTIVITE_NOMME', 'ADMIN_ACTIVITE_RETIRE', 'ADMIN_ORGANISATION_NOMME', 'ADMIN_ORGANISATION_RETIRE', 'PERSONNE_ARCHIVEE', 'PERSONNE_RETABLIE', 'PLACE_MODIFIEE') NOT NULL;

-- CreateTable
CREATE TABLE `PreferenceOrganisation` (
    `userId` VARCHAR(191) NOT NULL,
    `organisationId` VARCHAR(191) NOT NULL,
    `frequenceResume` ENUM('QUOTIDIEN', 'HEBDOMADAIRE', 'AUCUN') NOT NULL DEFAULT 'HEBDOMADAIRE',
    `mailModification` BOOLEAN NOT NULL DEFAULT true,
    `mailEcheance` BOOLEAN NOT NULL DEFAULT true,
    `applicationPerimetre` BOOLEAN NOT NULL DEFAULT true,
    `pushTaches` BOOLEAN NOT NULL DEFAULT true,
    `pushEcheances` BOOLEAN NOT NULL DEFAULT true,
    `mailDemandes` BOOLEAN NOT NULL DEFAULT true,
    `pushDemandes` BOOLEAN NOT NULL DEFAULT true,
    `applicationEquipe` BOOLEAN NOT NULL DEFAULT true,
    `pushEquipe` BOOLEAN NOT NULL DEFAULT false,
    `resumeAdmin` BOOLEAN NOT NULL DEFAULT true,
    `dernierResumeLe` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PreferenceOrganisation_organisationId_idx`(`organisationId`),
    PRIMARY KEY (`userId`, `organisationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Notification_userId_organisationId_niveau_lueLe_idx` ON `Notification`(`userId`, `organisationId`, `niveau`, `lueLe`);

-- AddForeignKey
ALTER TABLE `PreferenceOrganisation` ADD CONSTRAINT `PreferenceOrganisation_organisationId_fkey` FOREIGN KEY (`organisationId`) REFERENCES `Organisation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreferenceOrganisation` ADD CONSTRAINT `PreferenceOrganisation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des préférences (ADR 0032) : chaque organisation active ou archivée d'une
-- personne reçoit ses réglages actuels. La date du dernier résumé vient de la clé
-- de l'organisation dans `derniersResumes`, sinon de `dernierResumeLe` quand la
-- colonne JSON est vide (avant l'ADR 0008).
INSERT INTO `PreferenceOrganisation` (
  `userId`, `organisationId`, `frequenceResume`, `mailModification`, `mailEcheance`,
  `applicationPerimetre`, `pushTaches`, `pushEcheances`, `mailDemandes`,
  `pushDemandes`, `dernierResumeLe`, `updatedAt`
)
SELECT
  p.`userId`, a.`organisationId`, p.`frequenceResume`, p.`mailModification`,
  p.`mailEcheance`, p.`applicationPerimetre`, p.`pushTaches`, p.`pushEcheances`,
  p.`mailDemandes`, p.`pushDemandes`,
  CASE
    WHEN p.`derniersResumes` IS NULL THEN p.`dernierResumeLe`
    ELSE CAST(
      REPLACE(REPLACE(
        JSON_UNQUOTE(JSON_EXTRACT(p.`derniersResumes`, CONCAT('$."', a.`organisationId`, '"'))),
        'T', ' '), 'Z', '')
      AS DATETIME(3))
  END,
  NOW(3)
FROM `PreferenceNotification` p
INNER JOIN `Appartenance` a ON a.`userId` = p.`userId`;

-- Niveau des notifications d'admin existantes (ADR 0033) : admin de l'activité
-- quand la personne l'administre, admin de l'organisation sinon.
UPDATE `Notification` n
SET n.`niveau` = CASE
  WHEN n.`activiteId` IS NOT NULL AND EXISTS (
    SELECT 1 FROM `AdminActivite` aa
    WHERE aa.`userId` = n.`userId` AND aa.`activiteId` = n.`activiteId`
  ) THEN 'ADMIN_ACTIVITE'
  ELSE 'ADMIN_ORGANISATION'
END
WHERE n.`type` IN ('DEMANDE_RECUE', 'INVITATION_ACCEPTEE');
