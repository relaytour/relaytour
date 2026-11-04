---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.26.0
fr:
  titre: >-
    L'administration de l'installation peut limiter le nombre de membres d'une organisation
  texte: >-
    L'API d'administration et la commande `organisation:creer` acceptent une limite
    de membres (`limites.membres`, option `--limite-membres`). Une place correspond à
    un membre actif ou à une invitation en attente. Au-delà de la limite,
    l'organisation ne peut plus inviter, accepter une demande, importer une équipe ni
    rétablir une personne archivée. Archiver une personne libère sa place. La requête
    `organisations` indique les places occupées (`placesMembresOccupees`). Les fiches
    bénévoles ne comptent pas. Une organisation sans limite n'est pas concernée (ADR 0058).
---

La limite vit dans la colonne `Organisation.limiteMembres`, hors du JSON `limites`.
`lib/limites.ts` compte les places sous le verrou de la ligne de l'organisation
(`placesMembres`), et chaque entrée en consomme une avant d'écrire.
