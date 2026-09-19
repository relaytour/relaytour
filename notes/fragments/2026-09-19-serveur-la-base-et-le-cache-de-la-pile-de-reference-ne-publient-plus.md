---
cible: serveur
type: securite
audience: interne
etat: prevu
fr:
  titre: >-
    La base et le cache de la pile de référence ne publient plus de port
  texte: >-
    Dans la pile Compose de référence, MariaDB et Valkey ne sont plus
    joignables que par les conteneurs de la pile. La file des mails contient
    des codes de connexion en clair pendant quelques minutes, et un port
    publié les rendait lisibles par tout processus de la machine.
---

- `infra/compose/docker-compose.yml` : blocs `ports` de `db` et `cache` retirés,
  variables `MARIADB_PORT` et `REDIS_PORT` retirées de `.env.example`.
- Un exploitant qui a besoin d'un accès local publie le port dans sa surcharge,
  sur `127.0.0.1` seulement (`infra/README.md`).
