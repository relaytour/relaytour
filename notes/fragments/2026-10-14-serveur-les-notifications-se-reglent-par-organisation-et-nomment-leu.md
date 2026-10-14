---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.17.0
fr:
  titre: >-
    Les notifications se règlent par organisation et nomment leur activité
  texte: >-
    Les préférences de notification se règlent désormais dans chaque
    organisation : couper le résumé dans l'une ne le coupe plus dans les autres.
    Les mails et les notifications push nomment l'organisation et l'activité, et
    leurs liens ouvrent la bonne organisation. Les admins reçoivent de nouvelles
    notifications sur leur équipe, à part de celles de leurs tâches. Avant un
    retour à une version antérieure, suivez la consigne d'`infra/README.md`.
---

ADR 0032 et 0033. Table `PreferenceOrganisation` (clé `userId`,
`organisationId`), reprise depuis `PreferenceNotification`, qui n'est plus écrite.
Colonne `Notification.niveau` (`REFERENT`, `ADMIN_ACTIVITE`,
`ADMIN_ORGANISATION`) et douze nouveaux types. `notifications(admin: true)`,
`nombreNotificationsNonLues(admin: true)`, `notificationsAutresOrganisations`,
champs `activite`, `perimetre`, `periode` et `niveau` de `Notification`.
`marquerNotificationsLues` accepte `admin`, `activiteId` et `perimetreId`. Sujets
« Organisation · Activité : … », liens avec `?organisation=`, rappels et résumé
groupés par activité, section « Pour vos rôles d'admin » dans le résumé. Famille
de push `equipe`, désactivée par défaut. La configuration d'une organisation
prend l'identifiant d'adresse de sa ligne en base. Aucune notification ne part
pour une invitation refusée ou expirée (ADR 0030).
