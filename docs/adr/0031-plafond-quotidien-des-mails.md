# ADR 0031 — Plafond quotidien des mails d'une installation

- **Statut** : proposée
- **Date** : 2026-10-11
- Complète l'ADR 0007 (frontière entre le logiciel et son exploitation) et l'ADR 0008 (administration de l'installation).

## Contexte

Le worker envoie chaque mail de la file sans compter. Deux limites existent, et aucune ne borne le volume d'une installation :

- la demande d'un code de connexion est limitée par adresse ;
- le formulaire public est limité par adresse IP, par adresse de mail et par activité.

Une installation peut pourtant envoyer beaucoup de mails en peu de temps : l'invitation d'une longue liste de personnes, un import d'équipe avec ses mails, ou un compte d'admin détourné. Les conséquences touchent l'exploitation :

- un fournisseur de mail compte les envois par jour et bloque le compte au-delà de son quota ;
- un domaine d'envoi partagé entre plusieurs installations perd sa réputation par la faute d'une seule ;
- une installation d'essai, ouverte à une organisation encore inconnue, sert à envoyer des invitations non sollicitées.

Un hébergeur peut limiter les envois chez son fournisseur, mais cette limite vaut pour tout son compte, pas pour une installation. Le besoin entre donc dans le logiciel, sous une forme générique (ADR 0007).

## Décision

- Une variable d'environnement facultative, `COURRIEL_PLAFOND_QUOTIDIEN`, fixe le nombre de mails qu'une installation envoie par jour. Elle attend un entier positif. Absente, aucun plafond ne s'applique : une installation auto-hébergée garde le comportement actuel.
- Le plafond vaut pour l'installation entière, comme le transport SMTP et l'expéditeur. Une installation qui porte plusieurs organisations a un seul compteur.
- Le worker compte un mail au moment de l'envoi, dans un compteur de Redis nommé par le jour UTC (`lib/plafond-courriel.ts`). Le compteur ne contient ni adresse ni contenu.
- Au-delà du plafond, le mail n'est pas perdu : le worker le reporte au début du jour UTC suivant, étalé sur trente minutes. Un report ne consomme aucun essai du job.
- Le code de connexion part toujours et n'est pas compté. Une personne doit pouvoir se connecter, et sa demande est déjà limitée par adresse (ADR 0002).
- Un mail que le transport n'a pas pu remettre rend sa place : le nouvel essai la réserve de nouveau.
- Le worker journalise chaque report (`courriel-plafond-atteint`), avec la sorte du mail et le plafond, sans adresse (invariant 6).
- Si Redis ne répond pas, le mail part : la file dépend elle-même de Redis, et une panne ne doit pas retenir les mails.

## Conséquences

- La pile de référence passe la variable au worker (`infra/compose/docker-compose.yml`, `.env.example`). `docs/courriel.md` explique comment la régler.
- Un mail reporté arrive un jour plus tard. Un rappel « à la veille » peut donc arriver le jour de l'échéance. Le plafond se règle au-dessus du volume normal de l'installation : il borne un excès, il ne lisse pas l'activité courante.
- Une file qui dépasse le plafond chaque jour grossit. Le journal le montre par l'événement `courriel-plafond-atteint`, que l'exploitant surveille.
- L'administration de l'installation ne lit pas le compteur. Un compteur de mails envoyés dans la requête `organisations` reste hors de cette décision.
- Le plafond ne remplace ni les limites du fournisseur de mail, ni l'authentification du domaine d'envoi.

## Options écartées

- **Un plafond par organisation**, réglé par l'API d'administration comme les limites de l'ADR 0008. Le transport et le quota du fournisseur sont ceux de l'installation. Un plafond par organisation demanderait de rattacher chaque mail à une organisation, alors qu'un compte appartient à plusieurs.
- **Abandonner le mail au-delà du plafond.** Une invitation ou un rappel perdu ne se rattrape pas sans intervention.
- **Limiter le débit plutôt que le volume du jour.** Le pool SMTP borne déjà les envois simultanés, et les fournisseurs comptent par jour.
