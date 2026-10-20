# ADR 0037 — Agenda, réunions, convocations et abonnements

- **Statut** : acceptée
- **Date** : 2026-10-20
- Complète l'ADR 0025 (phases), l'ADR 0014 (consultation), l'ADR 0017 (flux des changements), l'ADR 0024 (notifications push) et l'ADR 0034 (plafond quotidien des mails).

## Contexte

Les phases d'une activité (ADR 0025) et les dates d'une période existent dans l'application. Aucun écran ne les présente sur un calendrier. Les équipes tiennent leurs réunions dans un autre outil : un agenda partagé, un sondage en ligne, une suite de mails. La date, le lieu et le lien de visio se perdent entre ces outils.

La feuille de route prévoyait une vue calendrier des échéances et un abonnement personnel au format iCalendar.

Le besoin porte sur quatre points :

- placer sur un calendrier les phases, les dates de la période et quelques dates choisies par les admins ;
- créer des réunions dans l'agenda d'une activité ou d'un périmètre, avec un lieu et un lien de visio ;
- convoquer les personnes concernées et connaître leur réponse ;
- retrouver ces dates dans l'agenda personnel de chaque personne (Outlook, Google, Apple).

Plusieurs options de synchronisation ont été envisagées. Une synchronisation par OAuth avec Google et Microsoft obligerait chaque installation à enregistrer ses propres applications auprès de ces services, et à garder leurs secrets. Un abonnement au format iCalendar fonctionne avec tous les agendas, sans compte tiers ni secret d'installation.

## Décision

### La notion

- Chaque activité a un **agenda**, lu sur l'écran « Agenda ». Il réunit, pour une période :
  - les phases de l'activité, calculées depuis le premier jour de la période (ADR 0025) ;
  - le premier et le dernier jour de la période ;
  - les **dates clés** de la période ;
  - les **réunions** de l'agenda global et des périmètres que la personne lit ;
  - en option, les échéances des tâches de ses périmètres.
- Une **date clé** est un jour, ou une suite de jours, qu'un admin de l'activité place dans l'agenda : un dossier à déposer, une assemblée, une visite du site. Elle porte un titre et une description facultative.
- Une **réunion** porte un titre, un début et une fin, un lieu, un lien de visio et une description. Le lieu, le lien et la description sont facultatifs. La v1 ne gère pas la récurrence.
- Une réunion appartient à l'**agenda global** de l'activité, ou à l'agenda d'un périmètre. Elle se rattache à une période, comme une tâche.
- Une réunion peut se lier à une ou plusieurs tâches de la même période, vingt au plus. Les tâches d'une réunion de périmètre appartiennent à ce périmètre. Les tâches d'une réunion globale appartiennent à un périmètre de l'activité. Le lien est facultatif et n'ouvre aucun droit.
- Une réunion ne se supprime pas. Elle s'annule, et son annulation prévient les personnes convoquées.

### Droits

- Les admins de l'activité et les admins de l'organisation créent, modifient et annulent les dates clés et les réunions de l'agenda global.
- Une personne qui écrit dans un périmètre (ADR 0014) crée, modifie et annule les réunions de ce périmètre. Les admins de l'activité le font aussi.
- Une période archivée passe en lecture seule : aucune date clé ni réunion ne s'y écrit.
- Toute personne qui voit l'activité lit son agenda global.
- Une personne lit les réunions d'un périmètre quand elle lit ce périmètre, ou quand elle est convoquée.
- En consultation, une personne lit le titre et l'horaire d'une réunion de périmètre. Elle ne lit ni le lieu, ni le lien de visio, ni la description.
- Une personne qui ne lit pas une tâche liée voit la réunion sans ce lien.

### Convocations

- Une **convocation** invite une personne de l'équipe à une réunion. Le mot « invitation » reste réservé à l'entrée dans une organisation (ADR 0030).
- La personne qui crée la réunion choisit les personnes convoquées : tout le périmètre, toute l'équipe de l'activité, ou des personnes choisies dans l'équipe. Le serveur vérifie chaque personne.
- Une convocation vise un compte, jamais une adresse saisie. Une personne sans compte n'est pas convoquée.
- Une réunion compte 300 personnes convoquées au plus.
- L'application envoie elle-même un mail de convocation, avec un fichier iCalendar (`METHOD:REQUEST`). Une modification du titre, de l'horaire, du lieu ou du lien envoie une nouvelle version. Une annulation envoie un fichier `METHOD:CANCEL`.
- Les modifications rapprochées d'une même réunion produisent un seul mail : l'envoi attend deux minutes et lit la réunion au dernier moment.
- La personne convoquée répond dans l'application : présente, absente ou peut-être. L'application ne lit pas les réponses envoyées depuis un agenda. Le mail le dit.
- La personne qui organise et les personnes qui écrivent dans l'agenda lisent les réponses, nominativement. Les autres personnes convoquées lisent les compteurs.
- Une personne retirée d'un périmètre quitte les réunions à venir de ce périmètre. Sa convocation est retirée, et un mail d'annulation retire l'événement de son agenda. Les réunions passées gardent sa convocation.
- Une personne archivée dans l'organisation (ADR 0031) quitte toutes les réunions à venir de l'organisation, sans mail.
- Une personne affectée à un périmètre après la création d'une réunion qui convoque tout le périmètre est convoquée à son tour.
- Les mails de convocation comptent dans le plafond quotidien (ADR 0034). Un mail reporté au lendemain par le plafond arrive après une réunion du jour même. L'écran indique « envoi en attente » tant que le mail n'est pas parti.
- Une convocation crée aussi une notification dans l'application, et une notification push de la famille « agenda » (ADR 0024).

### Abonnements

- Un **abonnement** est une adresse secrète qui sert l'agenda au format iCalendar, en lecture seule. Outlook, Google et Apple s'y abonnent et la relisent régulièrement.
- Chaque personne a au plus un abonnement personnel par organisation. Elle y choisit les périmètres et l'agenda global des activités qu'elle voit, et les échéances en option.
- Les admins d'une activité créent un abonnement d'activité. Il contient l'agenda global, les dates clés, les phases et les dates de la période. Il ne contient aucune réunion de périmètre.
- L'adresse contient un jeton aléatoire de 32 octets. Le serveur garde seulement son empreinte. L'adresse complète s'affiche une seule fois, à sa création.
- Une personne régénère ou révoque son abonnement à tout moment. Un admin de l'activité régénère ou révoque l'abonnement de l'activité.
- Le serveur vérifie les droits de la personne à chaque lecture. Une personne archivée, ou retirée d'un périmètre, perd aussitôt le contenu correspondant.
- Un abonnement ne contient jamais la liste des personnes convoquées.
- Un jeton inconnu, révoqué, mal formé, ou d'une organisation suspendue reçoit la même réponse 404.

### Sondages de dates

- Un **sondage** propose plusieurs créneaux pour une réunion à venir. Un créneau est un jour, ou un jour avec un horaire.
- Les droits de création suivent ceux des réunions : agenda global ou agenda d'un périmètre.
- Le sondage vise les mêmes personnes qu'une convocation. Chacune répond à chaque créneau dans l'application : oui, si besoin, ou non.
- La personne qui a créé le sondage le clôt. Elle transforme ensuite le créneau retenu en réunion préremplie.
- Une page de sondage ouverte à d'autres sujets reste hors du périmètre de cette décision.

### Fuseau horaire

- Les horaires se saisissent et s'affichent dans le fuseau de l'organisation.
- Le serveur garde les instants en UTC. Les fichiers iCalendar écrivent les horaires en UTC, et les agendas les affichent dans le fuseau de chaque appareil.
- Les phases, les dates clés, les dates de la période et les échéances sont des journées entières.

## Conséquences

- Une migration additive ajoute les tables `DateCle`, `Reunion`, `ReunionTache` et `ConvocationReunion`, puis `JetonAgenda`, puis les tables des sondages. Chaque table porte `organisationId`, et chaque unicité est bornée par un parent (invariant 18).
- Le modèle `Notification` reçoit `reunionId` et `sondageId`. L'énumération `TypeNotification` reçoit les types des réunions et des sondages. `PreferenceOrganisation` reçoit `pushAgenda`.
- Le serveur écrit lui-même ses fichiers iCalendar (`packages/server/src/lib/ics.ts`), sans dépendance nouvelle.
- Le transport des mails accepte une pièce iCalendar. La charge utile de la file ne contient que des identifiants (invariant 5).
- Le serveur sert les abonnements sous `/agenda/<jeton>.ics`. Le Caddyfile de référence, le proxy de développement et le service worker laissent passer ce chemin.
- Le journal ne contient jamais le jeton ni l'adresse d'un abonnement (invariant 6).
- Le flux des changements reçoit l'entité `AGENDA` (ADR 0017).
- L'écran « Agenda » suit « Rétroplanning » dans le menu. Il s'affiche en liste sur un téléphone, et en liste ou en mois sur un écran large.
- La table des refus croisés couvre chaque requête et chaque mutation : sans session, depuis une autre organisation, depuis un autre périmètre, sur une période archivée, pour une personne archivée, avec un jeton révoqué (invariant 11).
- Le glossaire reçoit les mots agenda, date clé, réunion, convocation, abonnement et sondage.
- Les modes d'emploi décrivent l'agenda pour chaque rôle.

## Revue de sécurité

- Une adresse d'abonnement est un secret. Sa fuite livre le contenu de l'agenda, jamais la liste des personnes convoquées. La personne la révoque d'un geste, et la révocation prend effet à la lecture suivante.
- La limite de lecture d'un abonnement se compte par jeton, car Google et Outlook partagent leurs adresses IP. Une seconde limite compte les jetons refusés par adresse IP.
- La réponse d'un abonnement porte `Cache-Control: private`, `X-Robots-Tag: noindex` et `Referrer-Policy: no-referrer`.
- Le mail de convocation ne nomme que la personne destinataire. Il ne révèle aucune autre personne convoquée.
- Une personne hors de l'équipe, ou d'une autre organisation, ne peut pas être convoquée. Le serveur la refuse comme un identifiant inconnu.
- Ni le lieu ni le lien de visio ne s'affichent en consultation. Une personne qui n'est ni affectée ni convoquée ne rejoint donc pas une réunion de périmètre par l'application.
