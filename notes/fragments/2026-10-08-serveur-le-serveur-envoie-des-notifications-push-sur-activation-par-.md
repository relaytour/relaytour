---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.13.0
fr:
  titre: >-
    Le serveur envoie des notifications push, sur activation par l'exploitant
  texte: >-
    Une installation peut ouvrir les notifications push. L'exploitant crée une
    paire de clés VAPID et renseigne `PUSH_VAPID_PUBLIQUE`, `PUSH_VAPID_PRIVEE`
    et `PUSH_VAPID_SUJET`. Sans ces variables, rien ne change. Le worker sort
    alors en HTTPS vers les services de push de Google, d'Apple, de Mozilla et
    de Microsoft. La mise à jour applique une migration additive.
---

ADR 0024. Modèle `AbonnementPush`, trois colonnes `push*` des préférences, file
BullMQ `push`, `push.processor.ts`, mutations `abonnerPush` et `desabonnerPush`,
champ public `clePubliquePush`. Dépendance `web-push` (MPL-2.0). L'adresse d'un
abonnement est limitée aux services de push connus.
