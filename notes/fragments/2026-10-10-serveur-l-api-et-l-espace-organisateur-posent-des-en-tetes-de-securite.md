---
cible: serveur
type: securite
audience: public
etat: prevu
fr:
  titre: >-
    L'API et l'espace organisateur posent des en-têtes de sécurité
  texte: >-
    L'API pose elle-même `X-Content-Type-Options`, `Referrer-Policy`,
    `X-Frame-Options`, `Permissions-Policy` et `Cross-Origin-Opener-Policy`, et une
    politique de contenu fermée en production. Le `Caddyfile` d'exemple pose les
    mêmes en-têtes sur les deux hôtes, y compris sur les chemins relayés vers
    l'API, et une politique de contenu pour l'espace organisateur. `/health` ne
    rend l'empreinte du commit et la date du build qu'à une requête locale.
---

La politique de contenu de l'espace organisateur n'autorise que l'origine pour les
scripts, les polices, les connexions et le service worker ; les styles inline
restent permis (antd) ; `img-src` admet `https:` pour les images des fiches, et le
commentaire du Caddyfile dit comment le retirer. Les installations qui ont copié
l'ancien Caddyfile le mettent à jour à la main : le dépôt ne livre qu'un exemple.
La page d'équipe d'une organisation (`pageEquipe`, `PAGE_EQUIPE`) n'accepte plus
qu'une adresse https.
