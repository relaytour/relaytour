---
cible: serveur
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Chaque activité a son identité, et l'export reprend tout le contenu
  texte: >-
    Une activité peut avoir son propre logo, ses couleurs, son contact de
    recrutement et sa page d'équipe. Les mails d'une tâche prennent l'identité
    de son activité. L'export écrit tout le contenu de l'organisation, et un
    import ne remplace plus une modification faite dans l'application.
---

- ADR 0009 : l'application devient la source de vérité du contenu ; export
  iso prouvé par un test d'aller-retour sur `content/exemple`.
- Table `Media` (PNG obligatoire, SVG facultatif sans script), route
  `/medias/<empreinte>.<png|svg>`, logo dans l'en-tête des mails.
- `adressesRoleAutorisees` : une boîte partagée chez une messagerie grand
  public s'autorise par son adresse complète ; ces domaines ne peuvent plus
  être des domaines de rôle.
- `orga:importer --forcer`, `CODE_SOURCE_URL`, migration additive
  `identite_et_medias`.
