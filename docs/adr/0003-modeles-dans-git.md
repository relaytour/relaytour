# ADR 0003 — Fiches et tâches types versionnées dans Git

- **Statut** : acceptée (mise en œuvre en phase 3)
- **Date** : 2026-09-15

## Contexte

Chaque édition doit repartir des process de la précédente. L'organisation rédige ses fiches méthode une première fois et veut un modèle commun. Les référent·es doivent aussi pouvoir modifier les fiches dans l'application, avec un historique.

## Décision

- Un dossier de contenu, propre à l'organisation et hors de ce dépôt, contient les périmètres, le gabarit commun des fiches, les fiches et les tâches types (échéances relatives, par exemple J-120).
- Un script `yarn orga:importer --edition <année>` crée les tâches de l'édition et ajoute une version de fiche seulement si le contenu diffère. Son analyseur est strict : un champ inconnu fait échouer l'import.
- Une fiche modifiée dans l'application n'est jamais écrasée par l'import : le script signale le conflit.
- `yarn orga:exporter` écrit les versions de l'application dans le dossier pour les reverser dans le dépôt de l'organisation en fin d'édition.

## Conséquences

- Git reste la source des modèles, la base reste la source de l'édition en cours.
- La CI valide le contenu d'exemple `content/exemple/` à chaque changement. Chaque organisation valide le sien avec `orga:valider <dossier>`.

## Mise en œuvre (phase 3, 16 septembre 2026)

- `yarn workspace @relaytour/server orga:valider` vérifie le dossier sans base, en CI. `orga:importer --simulation` affiche le rapport sans rien écrire.
- L'empreinte d'une version est le SHA-256 du titre et du contenu normalisés (fins de ligne, espaces de fin de ligne).
- Une tâche type n'est créée qu'une fois par édition (clé : édition, périmètre, `modele`), puis n'est plus jamais modifiée par l'import.
- Un périmètre présent en base mais absent du dépôt est signalé, jamais archivé.
- Les fiches ne doivent contenir aucune coordonnée personnelle : la validation et l'export les refusent, sauf les boîtes partagées des domaines listés dans `DOMAINES_COURRIEL_AUTORISES`.
- Les échéances s'écrivent `J-<jours>` ou `J+<jours>` par rapport au premier jour de l'édition.
- Le gabarit `modeles/fiche.md` est aussi celui que l'éditeur de l'application propose (import Vite `?raw`).
