---
cible: serveur
type: correctif
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Un module désactivé affiche son message au lieu d'une erreur du serveur
  texte: >-
    Une action sur un module désactivé de l'activité (agenda, bénévoles,
    documents) affichait « Le serveur a rencontré une erreur ». Elle affiche
    maintenant le message prévu, qui indique comment activer le module. Les
    erreurs du fournisseur cloud non connecté ou qui ne répond pas affichent
    aussi leur message.
en:
  titre: >-
    A disabled module shows its message instead of a server error
  texte: >-
    An action on a disabled module of the activity (agenda, volunteers,
    documents) showed "The server encountered an error". It now shows the
    intended message, which explains how to enable the module. The errors for
    a cloud provider that is not connected or does not respond also show their
    message.
---

`formaterErreur` masquait les codes `MODULE_INACTIF`, `ESPACE_FICHIERS_INDISPONIBLE`
et `FOURNISSEUR_INDISPONIBLE`, absents de `CODES_CONNUS`. Un test relève
désormais chaque code posé par une erreur GraphQL du serveur et vérifie qu'il
passe. La route REST rendait déjà `MODULE_INACTIF` en 403, mais avec le code
`INTERNAL_SERVER_ERROR` et le message générique.
