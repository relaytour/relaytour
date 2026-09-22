---
cible: serveur
type: correctif
audience: interne
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Le déploiement de référence démarre le worker après les migrations
  texte: >-
    Dans la pile Compose de référence, le worker attendait seulement la base
    et le cache : il pouvait démarrer sur un schéma pas encore migré. Il
    attend désormais la fin du service de migration, comme l'API. Sa sonde
    de vie lit le port configuré au lieu d'une valeur en dur.
---

- `depends_on.migrate.condition: service_completed_successfully` sur le
  service `worker` d'`infra/compose/docker-compose.yml`.
- `WORKER_HEALTH_PORT`, `DRAIN_GRACE_MS` et `SHUTDOWN_TIMEOUT_MS` documentés
  dans `packages/server/.env.example`.
