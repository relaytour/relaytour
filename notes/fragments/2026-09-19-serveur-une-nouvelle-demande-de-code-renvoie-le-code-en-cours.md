---
cible: serveur
type: securite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Une nouvelle demande de code renvoie le code en cours
  texte: >-
    Si vous demandez un nouveau code alors que le précédent est encore valable,
    vous recevez le même code et sa validité repart de 10 minutes. Une personne
    qui demande des codes sur votre adresse ne peut plus invalider celui que vous
    attendez. Les codes envoyés avant la mise à jour ne sont plus acceptés :
    demandez un nouveau code.
---

- `storeOTP: 'encrypted'` et `resendStrategy: 'reuse'` dans `packages/server/src/auth.ts` ; Better Auth ne réutilise un code que s'il peut le relire.
- Un code haché en attente au déploiement ne se déchiffre pas : la demande ou la saisie échoue pour cette adresse jusqu'à son expiration (10 minutes au plus).
- Un changement de `BETTER_AUTH_SECRET` a le même effet sur les codes en attente.
