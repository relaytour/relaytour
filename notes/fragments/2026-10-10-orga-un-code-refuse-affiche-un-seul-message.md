---
cible: orga
type: securite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Un code refusé affiche un seul message
  texte: >-
    Quand le code saisi est refusé, l'écran de connexion affiche « Le code est
    incorrect, expiré ou épuisé. Vérifiez-le, ou demandez un nouveau code. », quel
    que soit le cas. Le serveur ne distingue plus ces cas, pour ne pas révéler si
    une adresse a un compte.
---

Les messages « Le code a expiré » et « Trop d'essais avec ce code » disparaissent :
le serveur ne renvoie plus les codes `OTP_EXPIRED` et `TOO_MANY_ATTEMPTS`.
