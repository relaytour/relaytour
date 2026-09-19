# ADR 0004 — Déploiement de référence : une pile Compose sur un VPS

- **Statut** : acceptée
- **Date** : 2026-09-15
- Complétée par l'ADR 0007 : le dossier `infra/` se limite à une installation et à une liste d'étapes ; l'exploitation vit hors du dépôt.

## Contexte

Une association qui auto-héberge Relaytour a besoin d'un chemin de déploiement court, documenté et peu coûteux. Les données des personnes (référentes et référents, puis bénévoles) appartiennent à l'organisation et ne doivent pas dépendre de l'infrastructure d'un tiers.

## Décision

- Le déploiement de référence est un VPS au nom de l'organisation, sous Debian, avec Docker et Caddy installés sur l'hôte.
- Une pile Compose par installation, ports publiés sur `127.0.0.1` seulement. Plusieurs installations sur une machine se distinguent par leurs ports, dans la surcharge Compose de l'exploitant.
- Caddy sert l'API et l'espace organisateur et relaie `/api/auth/*` et `/graphql` vers l'API. Voir `infra/caddy/Caddyfile.example`.
- Sauvegarde quotidienne de MariaDB vers un stockage externe, restauration testée avant la mise en service.
- Le contenu de l'organisation (périmètres, fiches, tâches types) n'entre pas dans l'image : il se monte en volume et s'importe avec `orga-importer --dossier`.

## Conséquences

- Une panne de la machine arrête toutes les installations qu'elle héberge. Ce risque est accepté au regard du coût.
- Une installation d'essai ne contient jamais de données réelles.
- Un hébergeur qui sert plusieurs organisations sur une même installation relève de l'ADR 0006.
