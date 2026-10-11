---
cible: serveur
type: securite
audience: public
etat: prevu
fr:
  titre: >-
    Le compte d'une personne ne laisse plus rien passer d'une organisation à l'autre
  texte: >-
    Sur une installation qui porte plusieurs organisations, six points se
    resserrent. La date lue d'une personne est celle de son arrivée dans
    l'organisation, plus celle de la création de son compte. La limite d'un mail
    d'invitation par heure se compte par organisation. Un mail sans organisation
    désignée, comme le code de connexion d'une personne membre de plusieurs
    organisations, ne prend plus le nom ni le logo d'une organisation. La commande
    `creer-admin` n'accorde à un compte connu d'une autre organisation qu'une
    invitation à accepter. Un appareil ne garde l'abonnement push que d'un compte.
    Un admin ne lit l'adresse que d'un membre de son organisation. Une installation
    à une seule organisation ne voit aucun changement.
---

Audit du cloisonnement d'octobre 2026, à la suite de l'ADR 0030. `Personne.creeLe`
rend `Appartenance.createdAt` de l'organisation active (`membresDeLOrganisation`,
mémo par requête) ; `Personne.email` exige l'appartenance pour un admin de
l'organisation. Clé `relance-invitation:<organisation>:<personne>` (`cleRelance`).
`configurationOrganisation()` sans identifiant sert l'identité d'amorçage quand
l'installation porte plusieurs organisations : le sujet, le logo et l'expéditeur
par défaut ne sont plus ceux de la plus ancienne. `nommerAdmin`
(`lib/installation.ts`) porte la logique de `creer-admin` : invitation pour un
compte extérieur, compte archivé rétabli seulement s'il n'appartient qu'à cette
organisation, plus d'écriture du drapeau hérité `User.isAdmin`. `abonnerPush` retire
l'abonnement qu'un autre compte avait laissé sur le même appareil.
