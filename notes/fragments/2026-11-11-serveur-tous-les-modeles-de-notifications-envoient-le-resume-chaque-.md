---
cible: serveur
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.31.0
fr:
  titre: >-
    Tous les modèles de notifications envoient le résumé chaque semaine
  texte: >-
    Les modèles « Contact principal » et « Admin d'activité » envoient
    désormais le résumé par mail chaque lundi, comme les autres modèles. Si
    vous recevez le résumé chaque jour depuis la version précédente, vos
    préférences vous proposent le modèle de votre rôle. Vous pouvez aussi
    garder le résumé quotidien.
en:
  titre: >-
    All notification templates send the digest every week
  texte: >-
    The “Main contact” and “Activity admin” templates now send the email
    digest every Monday, like the other templates. If you have received the
    digest every day since the previous version, your preferences suggest the
    template of your role. You can also keep the daily digest.
---

`REGLAGES_DES_MODELES` de `lib/modeles-notification.ts` et ADR 0065. Aucune
migration : les réglages déjà enregistrés ne changent pas.
