# ADR 0053 — Adresse de réponse des mails

- **Statut** : proposée
- **Date** : 2026-10-29
- Complète l'ADR 0007 (frontière entre logiciel et exploitation), l'ADR 0036 (organigramme) et l'ADR 0048 (premiers pas).

## Contexte

Un mail de Relaytour porte l'en-tête `Reply-To` quand l'activité ou l'organisation déclare un contact. Sans contact, aucune adresse de réponse n'est posée : les réponses arrivent à l'expéditeur de l'installation (`COURRIEL_EXPEDITEUR`).

Un hébergeur peut envoyer depuis un domaine qui ne reçoit pas de courrier. C'est le cas d'un domaine d'envoi dédié, dont l'enregistrement MX pointe vers un service qui rejette ou ignore les messages. Sans contact déclaré, les réponses des membres sont alors perdues.

Pourtant, le pied de chaque mail invite à répondre : « Pour toute question, répondez à ce mail. » Une convocation iCalendar désigne aussi l'expéditeur comme organisateur de la réunion quand aucun contact n'existe.

Le contact d'une activité se rabat déjà sur celui de l'organisation. `CONTACT_RECRUTEMENT` n'est qu'une variable d'amorçage : la valeur vit ensuite dans la configuration, modifiable par les admins.

## Décision

### Un réglage d'installation

- `COURRIEL_EXPEDITEUR_SANS_REPONSE=true` déclare que la boîte de l'expéditeur ne reçoit pas de courrier. Absente ou fausse, Relaytour considère que l'expéditeur reçoit les réponses, comme avant cette décision.
- Le réglage est générique : il décrit l'installation, pas un hébergeur précis (ADR 0007). Une installation auto-hébergée qui envoie depuis une boîte réelle n'a rien à changer.

### Le pied d'un mail

- Le pied propose de répondre au mail dans deux cas : le mail porte un `Reply-To`, ou l'expéditeur reçoit du courrier.
- Sinon, le pied indique que l'adresse d'envoi ne reçoit pas de réponse. Il renvoie vers l'espace organisateur, ou vers l'espace bénévole pour un mail adressé à une fiche bénévole.
- La règle s'applique à toutes les sortes de mail, y compris le code de connexion et le mail d'essai, qui n'ont jamais de `Reply-To`.

### L'organisateur d'une convocation

- L'organisateur d'une réunion, dans le fichier iCalendar d'une convocation ou d'une annulation, suit la même règle : le contact de l'activité ou de l'organisation, sinon l'expéditeur s'il reçoit du courrier.
- Sans l'un ni l'autre, le fichier ne porte pas de ligne `ORGANIZER`. Le participant garde `RSVP=FALSE`, et la personne répond dans l'application (ADR 0037). Certains agendas affichent alors la personne comme organisatrice de l'événement ; une adresse de contact déclarée évite ce cas.

### Signaler l'absence de contact

- La liste « Premiers pas » (ADR 0048) reçoit une étape « Déclarer une adresse de contact », placée avant « Inviter l'équipe ». Le serveur la coche dès que l'activité a un contact, le sien ou celui de son organisation.
- Une activité qui avait terminé ses premiers pas sans contact voit donc la liste revenir avec cette seule étape. Un admin peut la masquer.
- L'écran « Organisation » signale l'absence de contact de l'organisation. Le texte précise si les réponses arrivent à l'expéditeur ou si l'installation ne les reçoit pas.

### Pas de repli sur l'adresse d'un admin

- Relaytour ne prend jamais l'adresse personnelle d'un admin comme adresse de réponse par défaut. Le contact reste une adresse de rôle (invariant 16), et une adresse personnelle ne s'affiche qu'avec l'accord de la personne (ADR 0036).
- Un admin peut reprendre sa propre adresse comme contact, par une action explicite, sur l'écran « Organisation » ou sur l'écran « Activités ». L'action n'apparaît que si son adresse est déjà une adresse de rôle de l'organisation. Elle n'ajoute jamais d'adresse aux adresses de rôle déclarées.
- Un hébergeur peut amorcer le contact à la création d'une installation, avec l'adresse que son client indique pour cet usage. Ce choix relève de son exploitation (ADR 0007).

## Conséquences

- Une installation qui déclare `COURRIEL_EXPEDITEUR_SANS_REPONSE` ne promet plus une réponse qui se perd.
- Une installation existante ne change pas de comportement tant que le réglage est absent.
- Les membres d'une organisation sans contact passent par l'espace organisateur, où l'organigramme et le bouton « Support » donnent les contacts.
- Le contrôle des agendas sans ligne `ORGANIZER` reste à faire en recette, sur les messageries courantes.
