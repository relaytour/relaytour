---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    L'API sert la page de l'espace organisateur avec l'aperçu d'un lien
  texte: >-
    La route `/espace/page` sert `index.html` avec le nom de l'organisation
    dans les balises Open Graph. Elle lit le dossier
    `ESPACE_ORGANISATEUR_DOSSIER`, monté en lecture seule. Le `Caddyfile`
    d'exemple relaie vers elle toute adresse de l'espace qui ne désigne pas un
    fichier, et sert la page depuis le dossier si l'API ne la sert pas. Le
    Compose de référence monte `ORGA_DIR` dans l'API. `APERCU_NOM_SITE`,
    `APERCU_DESCRIPTION` et `APERCU_IMAGE` remplacent le nom du site, la
    description et l'image. Sans ces changements, un lien partagé montre
    l'aperçu fixe de Relaytour.
en:
  titre: >-
    The API serves the organizer workspace page with a link preview
  texte: >-
    The `/espace/page` route serves `index.html` with the organization's name
    in the Open Graph tags. It reads the `ESPACE_ORGANISATEUR_DOSSIER` folder,
    mounted read-only. The example `Caddyfile` relays every workspace address
    that does not name a file to this route, and serves the page from the
    folder when the API does not serve it. The reference Compose file mounts
    `ORGA_DIR` into the API. `APERCU_NOM_SITE`, `APERCU_DESCRIPTION` and
    `APERCU_IMAGE` replace the site name, the description and the image.
    Without these changes, a shared link shows the fixed Relaytour preview.
---

ADR 0073. `lib/apercu.ts` compose les balises et remplace le bloc entre
`apercu:debut` et `apercu:fin`. `route-page-organisateur.ts` désigne
l'organisation par `configurationPublique`, comme l'écran de connexion ; une
configuration sans ligne en base ne nomme personne. Une page composée se garde
une minute par slug ; hors cache, une adresse lit la base trente fois par minute
au plus. Caddy se replie sur le fichier pour un 404 ou un 5xx de l'API
(`handle_response`) et pour une API arrêtée (`handle_errors`). Caddy remplace la
politique de contenu de l'API (`header >`) et laisse le `no-cache` de la page
(`header ?Cache-Control`).
