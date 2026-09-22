-- Remplissage des activités et des appartenances (ADR 0008), deuxième étape.
-- Aucune structure ne change ici. Chaque instruction ne touche que les lignes
-- encore vides : relancer le remplissage ne crée rien en double.

-- Une activité par organisation qui n'en a pas : nature événement, slug et nom de
-- l'organisation, groupes sport et pôle, comme la disposition plate du contenu.
INSERT INTO `Activite` (`id`, `organisationId`, `slug`, `nom`, `sigle`, `nature`, `groupes`, `ordre`, `createdAt`, `updatedAt`)
SELECT
    CONCAT('act_', o.`id`),
    o.`id`,
    o.`slug`,
    o.`nom`,
    o.`sigle`,
    'EVENEMENT',
    '[{"cle":"sport","libelle":"Sport","libellePluriel":"Sports"},{"cle":"pole","libelle":"Pôle","libellePluriel":"Pôles"}]',
    0,
    NOW(3),
    NOW(3)
FROM `Organisation` o
WHERE NOT EXISTS (SELECT 1 FROM `Activite` a WHERE a.`organisationId` = o.`id`);

-- Les périodes, périmètres et fiches rejoignent la première activité de leur organisation.
UPDATE `Edition` e
SET e.`activiteId` = (SELECT a.`id` FROM `Activite` a WHERE a.`organisationId` = e.`organisationId` ORDER BY a.`createdAt`, a.`id` LIMIT 1)
WHERE e.`activiteId` IS NULL;

UPDATE `Perimetre` p
SET p.`activiteId` = (SELECT a.`id` FROM `Activite` a WHERE a.`organisationId` = p.`organisationId` ORDER BY a.`createdAt`, a.`id` LIMIT 1)
WHERE p.`activiteId` IS NULL;

UPDATE `Fiche` f
SET f.`activiteId` = (SELECT a.`id` FROM `Activite` a WHERE a.`organisationId` = f.`organisationId` ORDER BY a.`createdAt`, a.`id` LIMIT 1)
WHERE f.`activiteId` IS NULL;

-- Le groupe d'un périmètre reprend son type : SPORT devient sport, POLE devient pole.
UPDATE `Perimetre` SET `groupe` = LOWER(`type`) WHERE `groupe` IS NULL;

-- Chaque compte appartient à la première organisation, avec le rôle tiré de isAdmin.
-- Les comptes archivés gardent leur appartenance : l'archivage reste porté par le compte.
INSERT INTO `Appartenance` (`id`, `userId`, `organisationId`, `role`, `createdAt`, `updatedAt`)
SELECT
    CONCAT('app_', u.`id`),
    u.`id`,
    o.`id`,
    IF(u.`isAdmin`, 'ADMIN', 'MEMBRE'),
    NOW(3),
    NOW(3)
FROM `User` u
JOIN (SELECT `id` FROM `Organisation` ORDER BY `createdAt`, `id` LIMIT 1) o
WHERE NOT EXISTS (SELECT 1 FROM `Appartenance` ap WHERE ap.`userId` = u.`id`);
