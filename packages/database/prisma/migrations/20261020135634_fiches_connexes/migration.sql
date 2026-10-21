-- AlterTable
ALTER TABLE `Journal` MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE', 'DECLINAISON_PROPOSEE', 'DECLINAISON_ACCEPTEE', 'DECLINAISON_REFUSEE', 'DECLINAISON_IMPOSEE', 'FICHE_CONNEXE_MASQUEE', 'FICHE_CONNEXE_AFFICHEE') NOT NULL;

-- AlterTable
-- La liste reprend les valeurs de l'agenda (ADR 0037), déjà dans develop : cette
-- migration passe après la sienne.
ALTER TABLE `Notification` MODIFY `type` ENUM('TACHE_CREEE', 'TACHE_MODIFIEE', 'TACHE_ASSIGNEE', 'TACHE_DESASSIGNEE', 'ECHEANCE_PROCHE', 'TACHE_EN_RETARD', 'DEMANDE_RECUE', 'TACHE_STATUT', 'FICHE_CREEE', 'FICHE_MODIFIEE', 'DECLINAISON_PROPOSEE', 'DECLINAISON_ACCEPTEE', 'DECLINAISON_REFUSEE', 'TACHE_COMMENTEE', 'INVITATION_ACCEPTEE', 'AFFECTATION_AJOUTEE', 'AFFECTATION_RETIREE', 'SOUHAIT_FORMULE', 'DEMANDE_ACCEPTEE', 'DEMANDE_REFUSEE', 'ADMIN_ACTIVITE_NOMME', 'ADMIN_ACTIVITE_RETIRE', 'ADMIN_ORGANISATION_NOMME', 'ADMIN_ORGANISATION_RETIRE', 'PERSONNE_ARCHIVEE', 'PERSONNE_RETABLIE', 'PLACE_MODIFIEE', 'REUNION_CONVOQUEE', 'REUNION_MODIFIEE', 'REUNION_ANNULEE', 'SONDAGE_OUVERT', 'FICHE_CONNEXE') NOT NULL;

-- CreateTable
CREATE TABLE `FicheConnexe` (
    `id` VARCHAR(191) NOT NULL,
    `ficheId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NOT NULL,
    `ajouteeParId` VARCHAR(191) NULL,
    `ajouteeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FicheConnexe_perimetreId_idx`(`perimetreId`),
    UNIQUE INDEX `FicheConnexe_ficheId_perimetreId_key`(`ficheId`, `perimetreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FicheGroupeConnexe` (
    `id` VARCHAR(191) NOT NULL,
    `ficheId` VARCHAR(191) NOT NULL,
    `groupe` VARCHAR(191) NOT NULL,
    `ajouteParId` VARCHAR(191) NULL,
    `ajouteLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FicheGroupeConnexe_ficheId_groupe_key`(`ficheId`, `groupe`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FicheConnexeMasquee` (
    `id` VARCHAR(191) NOT NULL,
    `ficheId` VARCHAR(191) NOT NULL,
    `perimetreId` VARCHAR(191) NOT NULL,
    `masqueeParId` VARCHAR(191) NULL,
    `masqueeLe` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FicheConnexeMasquee_perimetreId_idx`(`perimetreId`),
    UNIQUE INDEX `FicheConnexeMasquee_ficheId_perimetreId_key`(`ficheId`, `perimetreId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FicheConnexe` ADD CONSTRAINT `FicheConnexe_ficheId_fkey` FOREIGN KEY (`ficheId`) REFERENCES `Fiche`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FicheConnexe` ADD CONSTRAINT `FicheConnexe_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FicheConnexe` ADD CONSTRAINT `FicheConnexe_ajouteeParId_fkey` FOREIGN KEY (`ajouteeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FicheGroupeConnexe` ADD CONSTRAINT `FicheGroupeConnexe_ficheId_fkey` FOREIGN KEY (`ficheId`) REFERENCES `Fiche`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FicheGroupeConnexe` ADD CONSTRAINT `FicheGroupeConnexe_ajouteParId_fkey` FOREIGN KEY (`ajouteParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FicheConnexeMasquee` ADD CONSTRAINT `FicheConnexeMasquee_ficheId_fkey` FOREIGN KEY (`ficheId`) REFERENCES `Fiche`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FicheConnexeMasquee` ADD CONSTRAINT `FicheConnexeMasquee_perimetreId_fkey` FOREIGN KEY (`perimetreId`) REFERENCES `Perimetre`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FicheConnexeMasquee` ADD CONSTRAINT `FicheConnexeMasquee_masqueeParId_fkey` FOREIGN KEY (`masqueeParId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
