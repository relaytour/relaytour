# ADR 0073 — Aperçu d'un lien partagé

- **Statut** : proposée
- **Date** : 2026-11-23
- Complète l'ADR 0004 (déploiement de référence), l'ADR 0007 (frontière entre le logiciel et son exploitation) et l'ADR 0023 (application installable).
- Ne remplace aucune règle d'une ADR acceptée.

## Contexte

Une personne partage souvent l'adresse de l'espace organisateur dans une messagerie : WhatsApp, iMessage, Slack, un mail. La messagerie lit alors la page pour composer un aperçu. Son robot n'exécute aucun script.

L'espace organisateur est une application d'une seule page. Son fichier `index.html` ne portait aucune balise Open Graph. Le titre et l'identité de l'organisation se posent par JavaScript, que le robot ne lit pas. La messagerie prenait donc la plus grande image de la page, l'icône d'application de 512 pixels, et l'affichait en grand. Le titre se limitait à « Espace organisateur ».

Caddy servait ce fichier tel quel, depuis le dossier que l'image `-orga` dépose. Le fichier ne peut donc pas nommer l'organisation : une même image sert toutes les installations.

## Décision

### Un aperçu fixe dans la page

- `index.html` porte un bloc d'aperçu entre deux commentaires, `apercu:debut` et `apercu:fin` : titre, description, balises Open Graph et carte `summary_large_image`.
- L'image est `/apercu.jpg`, de 1200 × 630 pixels : le logo de Relaytour, son nom et l'adresse relaytour.org.
- La description présente Relaytour comme logiciel libre et renvoie à relaytour.org.
- Cet aperçu fixe vaut pour toute installation dont le proxy sert la page lui-même.

### Un aperçu de l'organisation, servi par l'API

- L'API sert la page sous `/espace/page`. Elle lit `index.html` dans le dossier `ESPACE_ORGANISATEUR_DOSSIER`, monté en lecture seule, et remplace le bloc d'aperçu.
- Le proxy réécrit vers cette adresse toute requête de l'espace qui ne désigne pas un fichier existant, ainsi que la racine. Il transmet la requête de l'adresse d'origine.
- L'organisation se désigne comme sur l'écran de connexion : par le paramètre `organisation` de l'adresse, sinon par l'unique organisation de l'installation. Une installation à plusieurs organisations, sans slug connu, sert un aperçu qui ne nomme personne.
- L'aperçu ne porte que le nom de l'organisation, déjà public par l'écran de connexion et par le manifest (ADR 0023). Il ne lit jamais le contenu de la page désignée : une adresse de tâche ne donne ni son titre ni son périmètre.
- Le titre suit la langue de l'organisation (ADR 0047). Le serveur échappe le nom avant de l'écrire.
- La page porte `Cache-Control: no-cache` et la politique de contenu de l'espace organisateur.
- Sans `ESPACE_ORGANISATEUR_DOSSIER`, la route répond 404. Une page qui ne porte pas le bloc d'aperçu n'est jamais servie : la route répond 500 et le journal le note.

### Ce que l'hébergeur règle

- `APERCU_NOM_SITE` remplace le nom du site (« Relaytour »).
- `APERCU_DESCRIPTION` remplace la description.
- `APERCU_IMAGE` remplace l'image : une adresse https, ou un chemin de l'espace organisateur que le serveur complète par `ORIGINE_ORGA`.
- Ces trois variables sont génériques : une installation auto-hébergée les laisse vides, un hébergeur y présente son offre (ADR 0007). Le dépôt ne contient le nom d'aucun hébergeur.

### Le proxy de référence

- Le `Caddyfile` d'exemple sert un fichier existant tel quel, et relaie toute autre adresse de l'espace vers `/espace/page`.
- Si l'API ne répond pas, Caddy sert `index.html` depuis le dossier, avec l'aperçu fixe et les en-têtes de sécurité. L'application s'ouvre et affiche son propre message d'erreur. Les chemins de l'API gardent leur erreur.
- Une seule politique de contenu part avec la page : Caddy remplace celle de l'API (`header >`).
- Le Compose de référence monte `ORGA_DIR` en lecture seule dans le conteneur de l'API.

## Conséquences

- Un lien partagé montre une carte de 1200 × 630 pixels au lieu de l'icône d'application.
- Le titre d'un lien nomme l'organisation sur une installation à une organisation, ou avec le paramètre `organisation`.
- Une installation qui garde son ancien proxy reçoit l'aperçu fixe sans autre changement. Elle reçoit l'aperçu de l'organisation après la mise à jour de son proxy et de son Compose.
- Chaque ouverture d'une page passe par l'API, qui lit la configuration publique de l'organisation. Cette lecture est déjà faite par l'écran de connexion, et la page se garde en mémoire tant que son fichier ne change pas.
- Le service worker garde `/index.html`, servi tel quel par le proxy. Le repli hors connexion ne change pas (ADR 0023).

## Options écartées

- **Une image par organisation, tirée de son logo.** Un logo est une image carrée ou étroite. La messagerie l'afficherait en grand, comme l'icône d'application. Une carte composée par le serveur demanderait une bibliothèque de dessin.
- **Renvoyer le lien vers relaytour.org par `og:url`.** Un aperçu ne redirige pas : un clic ouvre toujours l'adresse partagée. Certaines messageries regroupent les liens sous `og:url`, et tous les espaces se confondraient avec le site public.
- **Servir l'aperçu aux seuls robots, d'après leur agent utilisateur.** La liste des robots change sans préavis, et deux réponses différentes pour une même adresse compliquent le diagnostic.
- **Les gabarits de Caddy (`templates`).** Ils lient le logiciel à Caddy et laissent des balises brutes dans la page du serveur de développement de Vite.
- **Écrire l'aperçu au dépôt des fichiers par le service `orga`.** Le service ne lit pas la base : il ne connaît ni le nom actuel de l'organisation ni sa langue.
