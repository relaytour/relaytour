---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    Un dossier lié sert plusieurs périmètres et des groupes
  texte: >-
    Dans l'écran « Fournisseur cloud », vous choisissez les lecteurs d'un
    dossier lié : toute l'activité, ou une liste de périmètres et de groupes.
    Un groupe, comme les sports ou les pôles, vaut aussi pour les périmètres
    qui le rejoindront. Avec le bouton « Modifier », vous changez les lecteurs
    et le nom affiché d'un dossier sans le retirer. Avant l'enregistrement,
    Relaytour annonce les documents liés que les lecteurs de leur fiche ne
    liraient plus. Dans la vue « Documents », chaque personne retrouve un
    dossier sous son groupe ou sous son périmètre.
---

ADR 0043 : `DossierLie.touteActivite`, tables `DossierLiePerimetre` et
`DossierLieGroupe`, reprise des liens existants par la migration.
`perimetreId` reste en base et porte le premier périmètre des lecteurs, pour
qu'une version antérieure lise moins de personnes, jamais plus. `lierDossier`
reçoit `lecteurs` et refuse un second lien du même dossier dans l'activité.
Ajouts : `modifierDossierLie`, `effetsLecteursDossier`, `DossierLie.lecteursLus`.
La lecture d'un dossier ne passe plus par `peutLireFiche`, qui recevait
l'identifiant du dossier comme celui d'une fiche. Un dossier publie un signal
`FICHIERS` par périmètre que ses lecteurs désignent. L'export complet reprend
les lecteurs.
