---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
version: 0.11.0
fr:
  titre: >-
    Les admins déclarent l'adresse de support de l'organisation
  texte: >-
    L'écran « Organisation » reçoit le champ « Adresse de support ». L'adresse
    suit la règle des adresses de rôle. Le bouton « Support » du menu du compte
    ouvre un mail à cette adresse pour chaque membre. Le champ `contactSupport`
    d'`organisation.yaml` porte la même adresse dans le dépôt de contenu.
en:
  titre: >-
    Admins declare the organization’s support address
  texte: >-
    The “Organization” screen gains a “Support address” field. The address
    follows the role address rule. The “Support” button in the account menu
    opens an email to this address for each member. The `contactSupport` field
    of `organisation.yaml` carries the same address in the content repository.
---

- `DeclarationOrganisationSchema.contactSupport`, mutation
  `modifierIdentiteOrganisation`, export du contenu. Aucune migration.
