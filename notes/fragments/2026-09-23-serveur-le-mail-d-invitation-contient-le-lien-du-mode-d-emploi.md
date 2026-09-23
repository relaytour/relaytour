---
cible: serveur
type: fonctionnalite
audience: organisateurs
etat: prevu
version: 0.6.0
fr:
  titre: >-
    Le mail d'invitation contient le lien du mode d'emploi de votre rôle
  texte: >-
    Une personne invitée reçoit le lien du mode d'emploi qui correspond à son
    rôle : admin de l'organisation, admin d'activité, ou référente et
    référent. Une invitation renvoyée après une nomination contient le mode
    d'emploi du nouveau rôle.
---

- `lib/modes-d-emploi.ts` : le rôle se lit au moment de l'envoi, dans
  l'organisation du mail. La charge utile du job ne change pas.
- Nouvelle variable facultative `MODES_D_EMPLOI_URL`, sur le modèle de
  `CODE_SOURCE_URL`.
