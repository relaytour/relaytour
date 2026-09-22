---
cible: serveur
type: fonctionnalite
audience: organisateurs
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Chaque organisation décrit son identité dans son dépôt
  texte: >-
    Le dossier de contenu porte un fichier organisation.yaml : nom, sigle,
    fuseau horaire, domaines de mail autorisés, contact de recrutement, page
    équipe et thème. La validation le lit avec les périmètres, les fiches et
    les tâches types, et n'a plus besoin de variable d'environnement pour les
    domaines autorisés.
---

- `organisation.yaml` obligatoire, validé par `DeclarationOrganisationSchema`
  (`packages/server/src/orga/modeles.ts`).
- `content/exemple/organisation.yaml` et README ; `orga:valider` affiche le nom.
