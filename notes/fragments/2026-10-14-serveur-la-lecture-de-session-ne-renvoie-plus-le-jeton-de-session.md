---
cible: serveur
type: securite
audience: public
etat: prevu
version: 0.17.0
fr:
  titre: >-
    La lecture de session ne renvoie plus le jeton de session
  texte: >-
    La route `/api/auth/get-session` ne renvoie plus le jeton de session dans le
    corps de sa réponse. Seul le cookie le transporte, comme pour la connexion. Un
    script injecté dans la page ne peut donc plus lire ce jeton.
---

ADR 0035. Le hook `after` de Better Auth retire `session.token` du corps de
`/get-session`, comme il retire `token` de celui de `/sign-in/email-otp`. L'espace
organisateur n'appelle pas cette route, et le serveur ne lit que l'identifiant de
la personne. Test HTTP dans `auth.integration.test.ts`.
