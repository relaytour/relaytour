---
cible: serveur
type: rupture
audience: public
fr:
  titre: >-
    Le lien de l'export d'une installation en sommeil part depuis le conteneur du worker
  texte: >-
    Dans la pile de référence, seul le worker reçoit le SMTP. La mutation
    `envoyerLienDExport` répondait donc vrai sans envoyer le lien. Elle est
    remplacée par la commande `envoyer-lien-export <organisation>`, lancée dans
    un conteneur ponctuel du worker, qui lit le jeton sur son entrée standard
    (ADR 0057). Sans SMTP, l'envoi échoue et garde le jeton.
  migration: >-
    Remplacez l'appel de la mutation `envoyerLienDExport` par la commande
    `docker compose --env-file .env run --rm --no-deps -T worker node
    dist/envoyer-lien-export.js <organisation>`, lancée pendant que la pile tourne.
    Passez le jeton rendu par `preparerExportPourAdmin` sur l'entrée standard de
    la commande, jamais dans ses arguments. La commande se termine avec le code 1
    quand le lien n'est pas parti.
---

`scripts/envoyer-lien-export.ts`. `envoyerLienDExport()` refuse un envoi sans
transport, après la vérification du jeton, et le rend pour un nouvel essai.
