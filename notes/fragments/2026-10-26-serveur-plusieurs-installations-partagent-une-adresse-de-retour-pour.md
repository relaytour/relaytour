---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    Plusieurs installations partagent une adresse de retour pour l'espace de fichiers
  texte: >-
    Si vous servez plusieurs installations avec les mêmes applications chez
    Microsoft, Google et Dropbox, vous pouvez leur donner une adresse de retour
    commune. Vous n'inscrivez alors plus chaque installation chez chaque
    fournisseur. Chaque installation place son étiquette devant l'état de la
    connexion, et votre relais redirige le retour vers elle. Sans réglage, rien
    ne change.
---

ADR 0051. Variables `ESPACE_FICHIERS_RETOUR` (adresse https sans requête, à
laquelle le serveur ajoute `/sharepoint`, `/google` ou `/dropbox`) et
`ESPACE_FICHIERS_RETOUR_ETIQUETTE` (exigée avec la première). L'état devient
`<étiquette>.<aléa>`, et `reprendreConnexion` n'accepte que la forme que
l'installation émet. `infra/README.md` donne un exemple de relais Caddy, sans
journal d'accès.
