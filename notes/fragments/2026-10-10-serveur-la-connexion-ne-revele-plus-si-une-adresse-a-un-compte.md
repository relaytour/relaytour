---
cible: serveur
type: securite
audience: public
etat: prevu
fr:
  titre: >-
    La connexion ne révèle plus si une adresse a un compte
  texte: >-
    Un code refusé reçoit la même réponse pour une adresse qui a un compte et pour
    une adresse inconnue, quel que soit le nombre d'essais. Une adresse ne reçoit
    plus que vingt codes par jour, en plus des cinq codes par quart d'heure. La
    réponse d'une connexion réussie ne porte plus le jeton de session : seul le
    cookie le transporte.
---

Better Auth répondait « trop d'essais » (403) après le cinquième essai faux et
« code expiré » pour une adresse connue, et toujours « code invalide » pour une
adresse inconnue : six essais suffisaient à savoir si une adresse était connue. Un
hook `after` sur `/sign-in/email-otp` ramène ces deux réponses à « code invalide »
(400), pour un code faux comme pour un code expiré. Le test
`auth.integration.test.ts` compare les séquences et vérifie l'absence du jeton. Le
plafond quotidien borne la force brute à 100 essais par jour sur un million de codes.
