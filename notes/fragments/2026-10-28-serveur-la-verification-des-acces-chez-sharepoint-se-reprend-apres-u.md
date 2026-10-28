---
cible: serveur
type: correctif
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    La vérification des accès chez SharePoint se reprend après un refus de l’annuaire
  texte: >-
    Une connexion dont le compte n’obtient pas la lecture de l’annuaire reste
    limitée aux fichiers, et un avis vous le signale. Quand la vérification
    échoue, le panneau « Vérification des accès » propose de reconnecter le
    fournisseur. Une nouvelle connexion efface l’erreur précédente et relance la
    vérification.
en:
  titre: >-
    The SharePoint access check can be resumed after the directory is refused
  texte: >-
    A connection whose account does not obtain read access to the directory
    stays limited to files, and a notice tells you so. When the check fails,
    the “Access check” panel offers to reconnect the provider. A new connection
    clears the previous error and starts the check again.
---

Au retour de Microsoft, la portée enregistrée suit le champ `scope` de la
réponse de jeton (`porteeAccordee`), au plus la portée demandée, et l'issue
devient `partielle` quand elle redescend. Un refus 401 ou 403 de Graph sur la
recherche de comptes lève `AnnuaireRefuse`, qui donne une erreur propre.
`enregistrerConnexion` et `reglerPorteeConnexion` effacent `accesErreur`, puis
planifient la vérification.
