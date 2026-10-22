---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    Les admins vérifient les accès des équipes chez le fournisseur cloud
  texte: >-
    L'écran « Fournisseur cloud » reçoit les onglets « Vérification des accès »
    et « Comptes ». Avec SharePoint, un admin de l'organisation active la
    vérification par une nouvelle connexion, qu'un admin Microsoft Entra
    accepte. Relaytour compare alors, pour chaque dossier lié, les personnes
    attendues aux droits du dossier : il les range par équipe et dit qui a
    accès, qui n'a pas de compte, qui n'a pas d'accès. Il nomme aussi les accès
    en trop. Chaque dossier lié règle les personnes attendues : tous les
    membres, ou les contacts principaux seulement. Relaytour ne change aucun
    droit chez le fournisseur.
---

ADR 0044 : `ConnexionFichiers.portee` (`FICHIERS`, `ANNUAIRE`, `GESTION`),
`DossierLie.attendus`, tables `CompteFournisseur` et `EtatAccesDossier`.
L'interface des fournisseurs reçoit un annuaire facultatif. SharePoint le
réalise par Microsoft Graph (`User.Read.All`, `GroupMember.Read.All`) : la
recherche se fait adresse par adresse, en lots de vingt. Les membres d'un
groupe de site SharePoint ne se lisent pas encore : ces groupes donnent l'état
« Inconnu ». Tâche `acces-fournisseur` dans la file `planification`, planifiée à
la demande et après une modification des lecteurs, et relancée chaque nuit.
Requêtes `verificationAcces` et `comptesFournisseur`, mutations
`verifierAccesFournisseur` et `saisirAdresseFournisseur`, réservées aux admins
de l'organisation.
