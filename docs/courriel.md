# Choisir un fournisseur de mail

Relaytour envoie des mails transactionnels : codes de connexion, invitations, rappels d'échéance, résumés. Il ne contient pas de serveur de mail et n'en aura pas : faire tourner un serveur d'envoi demande une surveillance de réputation qu'une association n'a pas à porter. L'application parle à un service SMTP fourni par l'organisation.

## Sur un poste et en recette

Mailpit reçoit tous les mails sans rien envoyer. Hors production, `COURRIEL_DELIVRABILITE` liste les seules adresses qui reçoivent vraiment un mail quand un SMTP réel est configuré ; le reste part dans Mailpit. Cette variable est une liste, jamais un booléen.

## En production

Vous choisissez un service SMTP : la boîte mail de votre hébergeur de domaine, un service d'envoi transactionnel ou le SMTP de votre suite bureautique.


|---|---|---|




Dans tous les cas, renseignez `COURRIEL_SMTP_HOTE`, `COURRIEL_SMTP_PORT` (465 pour TLS implicite), `COURRIEL_SMTP_UTILISATEUR`, `COURRIEL_SMTP_MOT_DE_PASSE` et `COURRIEL_EXPEDITEUR` dans le `.env` du serveur. L'expéditeur doit appartenir à un domaine que vous contrôlez.

## Délivrabilité

Avant l'ouverture, publiez sur le domaine de l'expéditeur :

1. **SPF** : un enregistrement TXT qui autorise votre fournisseur à envoyer pour votre domaine.
2. **DKIM** : la clé publique fournie par votre fournisseur, qui signe chaque mail.
3. **DMARC** : un enregistrement TXT `v=DMARC1; p=quarantine` avec une adresse de rapport.

Vérifiez la délivrabilité avant l'ouverture avec un service d'analyse d'en-têtes.

## Ce qui reste hors du dépôt

Le fournisseur retenu par un hébergeur qui sert plusieurs organisations, et son choix entre un domaine d'envoi partagé et un domaine par organisation, relèvent de son exploitation (ADR 0007).
