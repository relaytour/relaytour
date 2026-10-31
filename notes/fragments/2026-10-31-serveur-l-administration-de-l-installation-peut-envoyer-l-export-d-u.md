---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    L'administration de l'installation peut envoyer l'export d'une installation en sommeil à ses admins
  texte: >-
    La mutation `preparerExportPourAdmin(organisation, courriel)` écrit l'export
    complet dans `EXPORTS_DIR` quand l'adresse appartient à un admin actif, et
    rend le fichier et un jeton. Elle rend `null` pour toute autre adresse, ou
    quand un lien est parti depuis moins de 24 heures. Sans adresse, elle prépare
    le dernier export pour tous les admins. La mutation
    `envoyerLienDExport(organisation, jeton)` envoie tout de suite le lien de
    téléchargement, sans le worker, dans la langue de chaque admin (ADR 0057).
---

`lib/export-pour-admin.ts`. Valkey garde l'empreinte du jeton une heure, et la
date du dernier lien envoyé 24 heures. La sorte `lien-export` ne passe jamais
par la file ; elle entre dans le plafond quotidien sans jamais être reportée.
