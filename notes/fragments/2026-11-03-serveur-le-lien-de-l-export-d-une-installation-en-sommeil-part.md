---
cible: serveur
type: correctif
audience: public
fr:
  titre: >-
    Le lien de l'export d'une installation en sommeil part depuis le conteneur du worker
  texte: >-
    Dans la pile de référence, seul le worker reçoit le SMTP. La mutation
    `envoyerLienDExport` répondait donc vrai sans envoyer le lien. Elle est
    remplacée par la commande `envoyer-lien-export <organisation>`, lancée dans
    un conteneur ponctuel du worker, qui lit le jeton sur son entrée standard
    (ADR 0057). Sans SMTP, l'envoi échoue et garde le jeton. Un hébergeur qui
    appelait la mutation doit adapter son script.
---

`scripts/envoyer-lien-export.ts`. `envoyerLienDExport()` refuse un envoi sans
transport, après la vérification du jeton, et le rend pour un nouvel essai.
