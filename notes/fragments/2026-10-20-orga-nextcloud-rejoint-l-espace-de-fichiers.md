---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
version: 0.18.0
fr:
  titre: >-
    Nextcloud rejoint l'espace de fichiers
  texte: >-
    Vous saisissez l'adresse du Nextcloud de l'association, puis vous y
    accordez l'accès avec votre compte. Nextcloud crée un mot de passe
    d'application pour Relaytour, que vous pouvez révoquer dans ses
    paramètres de sécurité. Les documents s'ouvrent dans la liseuse ou se
    téléchargent.
---

ADR 0038 : fournisseur `NEXTCLOUD` (WebDAV), connexion par le Login Flow v2
(mutations `commencerConnexionNextcloud` et `terminerConnexionNextcloud`),
mot de passe d'application chiffré en base. L'exploitant admet les hôtes par
`NEXTCLOUD_HOTES` ; avec `*`, le serveur ne joint que des adresses publiques,
contrôlées au moment de la connexion. Un dossier lié se retrouve par son
identifiant (`oc:fileid`) grâce à une recherche WebDAV. Dépendances
`@xmldom/xmldom` et `undici` (MIT).
