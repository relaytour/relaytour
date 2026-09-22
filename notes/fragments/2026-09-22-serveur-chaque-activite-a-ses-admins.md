---
cible: serveur
type: securite
audience: organisateurs
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Chaque activité peut avoir ses admins, et chacun ne voit que ses activités
  texte: >-
    Un admin de l'organisation nomme des admins pour une activité. Ils gèrent
    ses périodes, ses périmètres, ses affectations et ses fiches, sans voir les
    autres activités. Une personne ne voit que les activités où elle est
    affectée.
---

- ADR 0010 : table `AdminActivite`, scope `gestion`, `exigerAdminDe` dans
  chaque résolveur de gestion, `activitesVisibles` dans `exigerActivite` et
  `exigerEdition`.
- La table des refus croisés s'exécute depuis trois sessions ; un test couvre
  ce que chaque rôle peut faire.
- La recherche ne renvoie plus les fiches communes d'une activité invisible.
