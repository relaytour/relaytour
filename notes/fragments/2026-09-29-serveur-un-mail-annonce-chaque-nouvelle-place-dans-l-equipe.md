---
cible: serveur
type: fonctionnalite
audience: organisateurs
etat: prevu
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
