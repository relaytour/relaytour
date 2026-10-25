---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Un dépôt d'organisation décrit plusieurs activités
  texte: >-
    Un dépôt d'organisation peut décrire plusieurs activités dans un dossier
    activites/, chacune avec sa nature, ses groupes de périmètres, ses fiches
    et ses tâches types. La disposition plate reste valide pour une seule
    activité. Un périmètre déclare son groupe ; le type SPORT ou POLE reste
    accepté.
en:
  titre: >-
    An organization repository describes several activities
  texte: >-
    An organization repository can describe several activities in an activites/
    folder, each with its kind, its area groups, its sheets, and its task
    templates. The flat layout remains valid for a single activity. An area
    declares its group; the SPORT or POLE type is still accepted.
---

- Lecteur de modèles : dispositions plate et `activites/`, `activite.yaml`,
  groupes, slug de fiche unique dans l'organisation.
- `orga:importer --organisation --activite` : activités créées ou mises à
  jour, activités absentes signalées, limite d'activités respectée, tâches de
  la période importées dans chaque activité qui en a une.
- `orga:exporter --organisation` : écriture dans la disposition du dossier.
- `content/exemple` passe en disposition `activites/`, avec un événement et
  une section de nature saison.
