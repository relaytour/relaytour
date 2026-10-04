---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
fr:
  titre: >-
    Les demandes pour rejoindre l'équipe attendent la décision d'un admin
  texte: >-
    Une demande porte le nom et l'adresse d'une personne qui veut rejoindre
    l'équipe d'une période. Une personne affectée à un périmètre la propose
    par `proposerPersonne`. Les admins de l'activité la lisent par `demandes`,
    puis l'acceptent ou la refusent. `accepterDemande` crée ou rattache le
    compte, crée les affectations choisies et note les autres périmètres en
    souhaits, dans une même transaction. Une migration additive crée les
    tables `Demande` et `DemandePerimetre`.
---

`schema/demandes.ts` et `lib/demandes.ts`. Une adresse a au plus une demande en
attente par période (`@@unique([editionId, adresseEnAttente])`). `proposerPersonne`
passe par `exigerEcriture` et répond toujours `true`. `signalerDemande` crée au plus
une notification `DEMANDE_RECUE` par admin, par activité et par jour ;
`Notification.activiteId` porte l'activité. `PostesPerimetre.demandesEnAttente`
compte les demandes de chaque périmètre. La table des refus croisés couvre les six
opérations. ADR 0015.
