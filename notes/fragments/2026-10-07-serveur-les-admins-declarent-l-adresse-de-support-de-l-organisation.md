---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    Les admins déclarent l'adresse de support de l'organisation
  texte: >-
    L'écran « Organisation » reçoit le champ « Adresse de support ». L'adresse
    suit la règle des adresses de rôle. Le bouton « Support » du menu du compte
    ouvre un mail à cette adresse pour chaque membre. Le champ `contactSupport`
    d'`organisation.yaml` porte la même adresse dans le dépôt de contenu.
---

- `DeclarationOrganisationSchema.contactSupport`, mutation
  `modifierIdentiteOrganisation`, export du contenu. Aucune migration.
