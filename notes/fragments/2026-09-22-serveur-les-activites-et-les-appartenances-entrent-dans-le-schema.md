---
cible: serveur
type: interne
audience: interne
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Les activités et les appartenances entrent dans le schéma
  texte: >-
    Une organisation porte désormais une ou plusieurs activités. Chaque période,
    périmètre et fiche appartient à une activité, et chaque périmètre à un
    groupe. Une table d'appartenances porte le rôle de chaque compte dans une
    organisation. L'application utilise encore une seule activité par
    organisation (ADR 0008, premier chantier).
---

- Trois migrations : `activites` (le journal Activite devient Journal par
  renommage, sans perte ; tables Activite et Appartenance ; statut et limites
  de l'organisation ; clés nullables), `activites_remplissage` (une activité
  par organisation, groupe tiré du type, appartenances tirées de `isAdmin`),
  `activites_obligatoire` (clés obligatoires ; année unique par activité, slug
  de périmètre par activité, slug de fiche par organisation).
- `activiteParDefaut()` sur chaque écriture ; le chantier « contexte » le
  remplacera par l'activité de la requête.
- L'import aligne l'activité implicite de la disposition plate sur
  `organisation.yaml` et cherche l'édition dans cette activité.
