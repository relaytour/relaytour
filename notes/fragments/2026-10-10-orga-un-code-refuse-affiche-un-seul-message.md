---
cible: orga
type: securite
audience: organisateurs
etat: prevu
version: 0.17.0
fr:
  titre: >-
    Un code refusé affiche un seul message
  texte: >-
    Quand le code saisi est refusé, l'écran de connexion affiche « Le code est
    incorrect, expiré ou épuisé. Vérifiez-le, ou demandez un nouveau code. », quel
    que soit le cas. Le serveur ne distingue plus ces cas, pour ne pas révéler si
    une adresse a un compte.
en:
  titre: >-
    A rejected code shows a single message
  texte: >-
    When the code entered is rejected, the sign-in screen shows “The code is
    incorrect, expired or used up. Check it, or request a new code.” in every
    case. The server no longer tells these cases apart, so it does not reveal
    whether an email address has an account.
---

Les messages « Le code a expiré » et « Trop d'essais avec ce code » disparaissent :
le serveur ne renvoie plus les codes `OTP_EXPIRED` et `TOO_MANY_ATTEMPTS`.
