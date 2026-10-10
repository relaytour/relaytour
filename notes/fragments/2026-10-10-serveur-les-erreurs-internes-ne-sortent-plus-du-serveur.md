---
cible: serveur
type: securite
audience: public
etat: prevu
fr:
  titre: >-
    Les erreurs internes ne sortent plus du serveur
  texte: >-
    Une erreur que l'API n'a pas prévue (base de données, exécution) répond par un
    message générique et une référence de huit caractères. Le journal du serveur
    garde le message et la pile sous cette référence. Les erreurs de saisie, de
    droits, de conflit et de limite ne changent pas.
---

`formatError` d'Apollo (`lib/erreurs.ts`, `formaterErreur`) : une erreur dont le
code n'est pas dans la liste connue (codes du serveur et codes d'Apollo sur une
requête mal formée) est remplacée. Avant, le message d'une erreur Prisma (colonne
trop courte, ligne absente, nom de contrainte) partait tel quel au client.
