# Signaler une faille

Si vous découvrez une faille de sécurité dans Relaytour, utilisez de préférence le signalement privé de vulnérabilités de GitHub sur ce dépôt (onglet « Security », puis « Report a vulnerability »). Sans compte GitHub, écrivez à [securite@relaytour.org](mailto:securite@relaytour.org). N'ouvrez pas de ticket public.

Nous accusons réception sous cinq jours ouvrés et nous vous tenons informé·e de la correction. Une faille corrigée fait l'objet d'une note de version.

## Versions corrigées

Seule la dernière version mineure publiée (`x.y`, étiquette d'image `x.y`) reçoit des correctifs de sécurité, sous la forme d'une version corrective (`x.y.z`). Une installation qui fixe `IMAGE_TAG=x.y` les reçoit à son prochain `docker compose up -d`.

## Délais

Nous publions un correctif dès qu'il est prêt, en visant 30 jours pour une faille exploitable à distance sans compte et 90 jours au plus pour les autres. La note de version cite la faille après la publication du correctif, jamais avant. Si vous souhaitez un délai avant toute publication, dites-le dans votre signalement.
