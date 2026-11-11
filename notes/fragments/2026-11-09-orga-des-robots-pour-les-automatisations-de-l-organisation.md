---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
version: 0.30.0
fr:
  titre: >-
    Des robots pour les automatisations de l'organisation
  texte: >-
    Sous le panneau « API » de l'écran « Organisation », un admin de
    l'organisation crée des robots : des membres sans connexion qui portent les
    jetons d'une automatisation partagée, comme une synchronisation avec un
    outil de gestion de projet. Un robot reçoit ses activités à sa création,
    puis ses affectations comme une personne. Il prend une place de membre, ne
    reçoit aucun mail et n'est jamais admin de l'organisation. L'annuaire et
    l'équipe l'affichent avec l'étiquette « robot ».
en:
  titre: >-
    Robots for the organization's automations
  texte: >-
    Under the "API" panel of the "Organization" screen, an organization admin
    creates robots: members without sign-in that hold the tokens of a shared
    automation, such as a sync with a project management tool. A robot gets its
    activities when it is created, then its appointments like a person. It takes
    a member seat, receives no email and is never an organization admin. The
    directory and the team show it with the "robot" tag.
---

ADR 0064. `lib/robots.ts`, `schema/robots.ts` (`robots`, `creerRobot`,
`creerJetonRobot`, `revoquerJetonRobot`) et `composants/RobotsApi.tsx`. Une
migration additive ajoute `User.robot`. `expedier` n'envoie rien à une adresse
`.invalid`, et `adresseValide` la refuse.
