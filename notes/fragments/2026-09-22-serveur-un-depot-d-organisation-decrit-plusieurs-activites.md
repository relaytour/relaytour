---
cible: serveur
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Un dépôt d'organisation décrit plusieurs activités
  texte: >-
    Un dépôt d'organisation peut décrire plusieurs activités dans un dossier
    activites/, chacune avec sa nature, ses groupes de périmètres, ses fiches
    et ses tâches types. La disposition plate reste valide pour une seule
    activité. Un périmètre déclare son groupe ; le type SPORT ou POLE reste
    accepté.
---

- Lecteur de modèles : dispositions plate et `activites/`, `activite.yaml`,
  groupes, slug de fiche unique dans l'organisation.
- `orga:importer --organisation --activite` : activités créées ou mises à
  jour, activités absentes signalées, limite d'activités respectée, tâches de
  la période importées dans chaque activité qui en a une.
- `orga:exporter --organisation` : écriture dans la disposition du dossier.
- `content/exemple` passe en disposition `activites/`, avec un événement et
  une section de nature saison.
