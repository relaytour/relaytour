# ADR 0050 — Désabonnement en un clic

- **Statut** : proposée
- **Date** : 2026-10-25
- Complète l'ADR 0016 (mail des demandes) et l'ADR 0032 (préférences par organisation).

## Contexte

Relaytour posait l'en-tête `List-Unsubscribe` sur trois mails : le résumé, les rappels d'échéance et les demandes. Cet en-tête menait à l'écran « Préférences », qui demande une connexion. Le mail de modification d'une tâche se désactivait dans les préférences, mais il ne portait ni l'en-tête ni de lien vers elles.

Gmail et Yahoo exigent depuis 2024 un désabonnement en un clic (RFC 8058) des expéditeurs de plus de 5 000 mails par jour. Une installation Relaytour reste aujourd'hui loin de ce volume, grâce au plafond quotidien de l'ADR 0034. Les messageries affichent pourtant leur bouton « Se désabonner » plus volontiers quand le mail le permet en un clic. Une personne qui ne trouve pas ce bouton signale plutôt le mail comme indésirable, ce qui nuit à la réputation du domaine de l'organisation.

## Décision

- Un mail porte les en-têtes `List-Unsubscribe` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click` quand la personne peut le désactiver dans ses préférences : modification d'une tâche (`mailModification`), échéances (`mailEcheance`), résumé (`frequenceResume`) et demandes (`mailDemandes`).
- Les mails transactionnels ne portent aucun en-tête de désabonnement : code de connexion, invitation, mail d'équipe, convocation et annulation de réunion, mails aux bénévoles, essai d'envoi. Une personne ne s'en désabonne pas, car ils accompagnent son compte, ses rôles ou une démarche qu'elle a faite.
- L'adresse de désabonnement vaut pour une personne, une organisation et une sorte de mail. Son jeton porte ces trois valeurs et une signature HMAC-SHA256 calculée avec le secret du serveur, sous le préfixe `relaytour:desabonnement:`. Le serveur ne garde rien en base.
- L'adresse vit sous `/medias/desabonnement/`, que le proxy relaie déjà vers l'API, comme les routes de l'espace de fichiers (ADR 0038). Aucune installation n'a à modifier son proxy.
- Un POST sur l'adresse coupe la préférence dans l'organisation du jeton, sans session ni cookie, comme le demande la RFC 8058. Les autres réglages et les autres organisations ne changent pas.
- Un GET n'écrit rien. Il affiche une page qui nomme le mail et l'organisation, avec un bouton de confirmation et un lien vers les préférences. Les filtres de sécurité des messageries ouvrent les liens des mails, et un GET qui désabonnerait les déclencherait.
- Le texte des mails désactivables garde son lien vers l'écran « Préférences ». Le mail de modification d'une tâche reçoit ce lien à son tour.

## Conséquences

- Changer le secret du serveur invalide les adresses des mails déjà envoyés. La page indique alors que le lien n'est pas valide et renvoie aux préférences.
- Une adresse ne s'expire pas. Une personne qui retrouve un ancien mail se désabonne encore. Le jeton ne fait que couper un mail, et la personne le réactive dans ses préférences.
- L'exploitant vérifie que son relais SMTP signe les en-têtes `List-Unsubscribe` et `List-Unsubscribe-Post` dans la signature DKIM. La RFC 8058 le demande, et Gmail ignore sinon le désabonnement en un clic.
- Une nouvelle préférence de mail ajoute sa sorte à `MAILS_DESABONNABLES` (`packages/server/src/lib/desabonnement.ts`).

## Revue de sécurité

- Un jeton se forge seulement avec le secret du serveur. Une charge modifiée, une sorte de mail inconnue ou une signature d'un autre usage sont refusées, et la comparaison se fait en temps constant.
- Le POST n'agit que sur la préférence de la personne et de l'organisation du jeton. Il ne lit ni n'affiche aucune donnée de la personne.
- La page de confirmation affiche le nom de l'organisation et le libellé du mail, sans l'adresse de la personne.
- Une adresse IP traite trente désabonnements par quart d'heure au plus. Le jeton ne s'écrit jamais dans le journal.
- La page porte sa propre politique de contenu : aucun script, des styles en ligne seulement, et un formulaire qui ne vise que la même origine.
