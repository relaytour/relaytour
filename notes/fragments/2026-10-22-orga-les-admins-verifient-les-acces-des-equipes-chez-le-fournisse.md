---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
version: 0.20.0
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
en:
  titre: >-
    Admins check team access at the cloud provider
  texte: >-
    The “Cloud provider” screen has two new tabs: “Access check” and “Accounts”.
    With SharePoint, an organization admin turns on the check with a new
    connection that a Microsoft Entra admin approves. For each linked folder,
    Relaytour then compares the expected people with the folder’s rights.
    Relaytour sorts them by team: who has access, who has no account, and who
    has no access. Relaytour also lists extra access. Each linked folder sets
    the expected people: all members, or main contacts only. The check changes
    no rights at the provider.
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
