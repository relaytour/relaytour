---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    L'administration de l'installation peut restreindre les modules d'une organisation
  texte: >-
    Si vous hébergez plusieurs organisations, vous pouvez choisir les modules
    que leurs activités peuvent activer : agenda, bénévoles et documents. Un
    module retiré se ferme dans toutes les activités de l'organisation, sans
    supprimer leurs données. Sans réglage, tous les modules restent autorisés.
---

ADR 0052. Colonne `Organisation.modulesAutorises` (nulle : tous). L'API
d'administration de l'installation la lit (`modulesAutorises` sur
`OrganisationInstallation`) et la règle dans `creerOrganisation` et
`modifierOrganisationInstallation` (`modulesAutorises`, ou
`autoriserTousLesModules`). Colonne `Activite.modules`, en base seulement.
