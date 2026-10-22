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
    L'écran « Fournisseur cloud » compte deux nouveaux onglets : «
    Vérification des accès » et « Comptes ». Avec SharePoint, un admin de
    l'organisation active la vérification par une nouvelle connexion, qu'un
    admin Microsoft Entra accepte. Pour chaque dossier lié, Relaytour compare
    alors les personnes attendues aux droits du dossier. Relaytour les range
    par équipe : qui a accès, qui n'a pas de compte, qui n'a pas d'accès.
    Relaytour nomme aussi les accès en trop. Chaque dossier lié règle les
    personnes attendues : tous les membres, ou les contacts principaux
    seulement. La vérification ne change aucun droit chez le fournisseur.
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
