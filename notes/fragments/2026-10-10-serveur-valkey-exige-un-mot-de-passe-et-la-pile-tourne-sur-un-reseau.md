---
cible: serveur
type: rupture
audience: public
etat: prevu
fr:
  titre: >-
    Valkey exige un mot de passe et la pile tourne sur un réseau interne
  texte: >-
    La pile Compose de référence donne un mot de passe à Valkey, dont la file
    contient des codes de connexion en clair pendant quelques minutes, et place la
    base, le cache et les services de l'application sur un réseau interne. Le
    service `orga` n'a plus de réseau.
  migration: >-
    Ajoutez `VALKEY_MOT_DE_PASSE` à votre `.env` (`openssl rand -hex 24`, lettres et
    chiffres seulement) avant `docker compose up -d`. La file en attente dans
    Valkey est conservée : le mot de passe s'applique au démarrage suivant.
---

`REDIS_URL` se construit dans `docker-compose.yml` à partir de la variable ; la
sonde `valkey-cli ping` lit le mot de passe dans `REDISCLI_AUTH`. Un seul réseau
`interne` remplace le réseau par défaut ; seul `server` publie un port, sur 127.0.0.1.
