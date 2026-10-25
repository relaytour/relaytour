---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.8.0
fr:
  titre: >-
    Un mail annonce chaque nouvelle place dans l'équipe
  texte: >-
    Une personne affectée à un périmètre ou nommée admin reçoit le mail « Votre
    place dans l'équipe a changé », avec la description de chaque nouveau
    périmètre et le mode d'emploi de son rôle. Les changements de dix minutes
    arrivent dans un seul mail. L'invitation liste aussi les périmètres de la
    personne ; sans périmètre, elle explique comment en obtenir un. Un souhait,
    un contact principal ou un retrait n'envoient aucun mail.
en:
  titre: >-
    An email announces each new place in the team
  texte: >-
    A person appointed to an area or named admin receives the “Your place in the
    team changed” email, with the description of each new area and the user
    guide for their role. Changes made within ten minutes arrive in a single
    email. The invitation also lists the person’s areas; without an area, it
    explains how to get one. An interest, a main contact, or a removal sends no
    email.
---

- `lib/equipe.ts` : fenêtres fixes de dix minutes, job différé
  `equipe-<personne>-<début>` (les doublons de la fenêtre sont ignorés). À
  l'envoi, le mail relit les affectations et les rôles créés pendant la
  fenêtre : un changement annulé ne s'annonce pas.
- `affecter`, `definirAdminActivite` et `modifierPersonne` annoncent le
  changement. `modifierPersonne` n'écrit le rôle que s'il change.
- Gabarit `equipe`, variables `situation` et `perimetres` dans `invitation`.
- Test : `mails-equipe.integration.test.ts`.
- ADR 0012.
