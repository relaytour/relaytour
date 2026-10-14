# ADR 0033 — Notifications d'admin, rangées par activité et par périmètre

- **Statut** : proposée
- **Date** : 2026-10-14
- Complète l'ADR 0032 (préférences par organisation, notifications qui nomment leur contexte), l'ADR 0016 (mail des demandes) et l'ADR 0030 (invitations).

## Contexte

La cloche mêle aujourd'hui deux sortes de nouvelles. Les unes concernent le travail d'une référente ou d'un référent : ses tâches, ses périmètres, ses échéances. Les autres concernent la gestion d'une activité ou de l'organisation : les demandes pour rejoindre l'équipe et les invitations acceptées.

Les admins reçoivent peu de nouvelles de gestion. Deux types seulement les concernent : `DEMANDE_RECUE` et `INVITATION_ACCEPTEE`. Ils n'apprennent pas qu'un autre admin a affecté une personne, qu'une personne a formulé un souhait ou qu'une invitation a expiré.

Un admin d'activité suit aussi beaucoup de périmètres, une vingtaine parfois. Une liste unique de notifications ne lui permet pas de voir quel périmètre demande son attention.

Enfin, le mail d'équipe (ADR 0012) annonce à une personne une nouvelle affectation ou une nomination. Il ne laisse aucune trace dans l'application : c'est le seul mail d'une action d'admin sans notification.

## Décision

### Chaque notification a un niveau

- Une notification porte un niveau : `REFERENT`, `ADMIN_ACTIVITE` ou `ADMIN_ORGANISATION`. Le niveau dit à quel titre la personne la reçoit.
- Le niveau `REFERENT` regroupe les notifications du travail sur les périmètres. Elles restent dans la cloche, rangées comme le décrit l'ADR 0032.
- Les deux niveaux d'admin forment les notifications d'admin. Elles quittent la cloche pour un écran à part.
- La migration ajoute la colonne avec la valeur `REFERENT`. Elle passe ensuite les notifications `DEMANDE_RECUE` et `INVITATION_ACCEPTEE` existantes au niveau d'admin qui leur correspond.

### Un écran « Notifications d'admin », avec sa route et son compteur

- L'écran vit à l'adresse `/<activité>/admin/notifications`. Il figure dans le menu, en tête des sections de gestion, avec son propre nombre de non lues.
- La cloche ne compte que les notifications du niveau `REFERENT`. Quand la personne a des notifications d'admin non lues, le panneau de la cloche l'indique par une ligne qui mène à l'écran.
- Seule une personne qui administre une activité ou l'organisation voit l'entrée du menu et ouvre l'écran.

### L'écran range par activité, puis par périmètre

- Le premier niveau de rangement est l'activité. Chaque groupe porte en tête le logo et le nom de l'activité, avec son nombre de non lues.
- Dans chaque activité, un second niveau range les notifications par périmètre, avec le nom, la couleur et le nombre de non lues du périmètre.
- Les notifications d'une activité sans périmètre, comme une nomination ou une demande, forment le sous-groupe « Toute l'activité », placé en tête.
- Les notifications de niveau `ADMIN_ORGANISATION` forment un groupe « Organisation », placé avant les activités.
- Chaque groupe et chaque sous-groupe se replie. Un groupe sans notification non lue s'ouvre replié.
- Chaque groupe se marque comme lu d'un seul geste.
- Chaque ligne affiche le rôle à ce titre : « Admin de l'activité » ou « Admin de l'organisation ».

### Les nouvelles notifications d'admin

Une action ne prévient jamais la personne qui l'a faite.

| Type | Niveau | Destinataires | Rangement |
|---|---|---|---|
| `AFFECTATION_AJOUTEE`, `AFFECTATION_RETIREE` | Admin d'activité | Les autres admins de l'activité | Périmètre |
| `SOUHAIT_FORMULE` : une personne formule un souhait dans « Tous les périmètres » | Admin d'activité | Les admins de l'activité | Périmètre |
| `DEMANDE_TRAITEE` : une demande acceptée ou refusée | Admin d'activité | Les autres admins de l'activité | Activité |
| `ADMIN_ACTIVITE_NOMME`, `ADMIN_ACTIVITE_RETIRE` | Admin d'activité | Les autres admins de l'activité | Activité |
| `ADMIN_ORGANISATION_NOMME`, `ADMIN_ORGANISATION_RETIRE` | Admin de l'organisation | Les autres admins de l'organisation | Organisation |
| `PERSONNE_ARCHIVEE`, `PERSONNE_RETABLIE` | Admin de l'organisation | Les autres admins de l'organisation | Organisation |
| `INVITATION_REFUSEE`, `INVITATION_EXPIREE` | Celui de l'invitation | La personne qui a invité, sinon les admins de l'organisation | Activité de l'invitation, sinon organisation |
| `DEMANDE_RECUE`, `INVITATION_ACCEPTEE` (existants) | Admin d'activité ou de l'organisation | Inchangés | Activité, sinon organisation |

- Une activité sans admin renvoie ses notifications d'admin aux admins de l'organisation, comme les demandes aujourd'hui (ADR 0016).
- Un admin de l'organisation ne reçoit pas les notifications d'une activité qui a ses propres admins. Il garde l'écran de chaque activité pour les consulter.
- Une même action répétée dans une tranche de dix minutes ne prévient qu'une fois, par une clé comme celle des notifications de périmètre.
- La commande `equipe-importer` et les scripts de l'installation ne créent aucune notification d'admin. Un import de cent personnes produirait sinon cent lignes.
- La purge nocturne crée `INVITATION_EXPIREE` avant d'effacer une invitation expirée.

### Le mail d'équipe a sa notification

- Une personne affectée, retirée ou nommée reçoit une notification `PLACE_MODIFIEE`, de niveau `REFERENT`. Elle accompagne le mail d'équipe, sans changer sa fenêtre de dix minutes.
- Un souhait, un contact principal et un retrait de souhait restent sans notification, comme ils restent sans mail (ADR 0012).

### Les préférences se règlent par niveau et par canal

Les préférences restent propres à chaque organisation (ADR 0032). L'écran « Préférences » les présente en deux sections.

| Section | Application | Mail | Push |
|---|---|---|---|
| Vos tâches et vos périmètres | Activité de vos périmètres (existant) | Modification de vos tâches, échéances (existants) | Tâches, échéances (existants) |
| Vos rôles d'admin : demandes et invitations | Toujours affichées | Demandes regroupées par heure (existant) | Demandes et invitations (existant, élargi) |
| Vos rôles d'admin : équipe | Affectations, souhaits, nominations, archivages (nouveau, activé) | Aucun mail immédiat | Équipe (nouveau, désactivé) |

- Le résumé par mail ajoute une section « Pour vos rôles d'admin », qui reprend les notifications d'admin non lues. Un réglage la retire du résumé.
- La section d'admin de l'écran ne s'affiche que pour une personne qui administre une activité ou l'organisation.
- Le serveur vérifie les préférences au moment de l'envoi, comme aujourd'hui.

## Options écartées

- **Un onglet d'admin dans le panneau de la cloche.** Il gardait un seul compteur pour deux sortes de nouvelles. Sur un téléphone, il ne pouvait pas porter un rangement à deux niveaux.
- **Toutes les notifications d'activité aux admins de l'organisation.** Les admins d'une organisation à dix activités recevraient alors des nouvelles que les admins d'activité traitent déjà.
- **Un mail immédiat pour chaque nouvelle d'équipe.** Les admins en recevraient plusieurs par heure pendant la constitution d'une équipe. Le résumé et le push couvrent ce besoin.
- **Un niveau calculé à la lecture**, d'après le rôle actuel de la personne. Le niveau d'une notification dépendrait alors de rôles changés depuis, et deux lectures de la même notification pourraient différer.

## Conséquences

- Une migration additive ajoute le niveau, les nouveaux types et les nouveaux réglages. Elle reprend le niveau des notifications existantes.
- Le menu gagne une entrée pour les admins, et la cloche perd les notifications de gestion.
- Les modes d'emploi des deux rôles d'admin décrivent le nouvel écran. Les captures de la cloche, des préférences et du nouvel écran sont à prendre.
- Une note de version d'audience `organisateurs`, avec le rôle `admin-activite`, annonce l'écran.

## Revue de sécurité

- Une notification d'admin ne porte que des identifiants, comme toutes les notifications. Son texte se compose à la lecture.
- L'écran ne liste que les notifications des activités que la personne administre encore, et celles de l'organisation quand elle en est admin. Une personne qui perd un rôle ne relit plus les notifications reçues à ce titre.
- Une demande ne nomme toujours pas la personne qui l'a déposée (ADR 0015). `DEMANDE_TRAITEE` dit seulement qu'une demande a été acceptée ou refusée.
- Une notification d'invitation refusée ou expirée ne nomme personne. L'invitation disparaît avec la réponse, et le compte invité reste inconnu de l'organisation (ADR 0030). Le texte dit seulement qu'une invitation de l'activité a été refusée ou a expiré.
- Des tests prouvent les refus. Une référente n'ouvre pas l'écran, et un admin d'une activité ne lit pas les notifications d'une autre. Une personne archivée ne reçoit plus rien.
