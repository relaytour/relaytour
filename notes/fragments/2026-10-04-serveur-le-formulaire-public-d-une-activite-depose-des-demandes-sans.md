---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
fr:
  titre: >-
    Le formulaire public d'une activité dépose des demandes sans session
  texte: >-
    La requête `formulaireRejoindre` et la mutation `envoyerDemande` se lisent
    sans session. Elles ne répondent que pour une organisation active, une
    activité non archivée, un formulaire ouvert, une période en préparation et
    un contact déclaré. Un dépôt crée une demande en attente, sans compte ni
    mail. `modifierActivite` reçoit le réglage du formulaire et son ouverture.
    Le réglage s'importe et s'exporte avec le contenu ; l'ouverture vit en
    base seulement. Le segment d'adresse `rejoindre` devient réservé : une
    activité ne peut plus le prendre comme identifiant.
---

`schema/formulaire.ts` et `lib/formulaire.ts`. Migration additive :
`Activite.formulaire`, `Activite.formulaireOuvert`, `Demande.disponibilite`,
`Demande.reponse`, `Demande.texte`. Limites d'un dépôt : 5 par heure par adresse IP
et 2 par jour par adresse mail (`limiterParCle` avec `siIndisponible: 'refuser'`),
60 par heure et 300 demandes en attente par activité, comptées en base. Un champ
piège, des tailles bornées et le refus des liens complètent la protection. Une
description de périmètre qui contient une coordonnée personnelle n'est pas
publiée. La réponse d'un dépôt accepté ne dit rien d'un compte ou d'une demande
déjà en attente. ADR 0015.
