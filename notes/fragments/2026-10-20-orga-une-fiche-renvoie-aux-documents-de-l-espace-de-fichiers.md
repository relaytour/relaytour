---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.18.0
fr:
  titre: >-
    Une fiche renvoie aux documents de l'espace de fichiers
  texte: >-
    Les personnes qui rédigent une fiche y lient des dossiers ou des fichiers
    de l'espace de fichiers, depuis le bloc « Ressources liées ». Vous ouvrez
    ces documents depuis la fiche, dans la liseuse. Un dossier lié à un autre
    périmètre ne peut pas être proposé. Dans une fiche connexe, une ressource
    d'un dossier que vous ne lisez pas porte la mention « Réservée au périmètre
    d'origine » et ne s'ouvre pas.
en:
  titre: >-
    A sheet links to documents in the file space
  texte: >-
    People who write a sheet link folders or files from the file space to it,
    using the “Linked documents” block. You open these documents from the sheet,
    in the viewer. A folder linked to another area cannot be proposed. In a
    related sheet, a resource from a folder you cannot read shows the label
    “Restricted to the original area” and does not open.
---

ADR 0038 : table `RessourceFiche` (dossier lié et chemin de noms), champ
`Fiche.ressources`, mutations `lierRessourceFiche` et `delierRessourceFiche`,
trente ressources par fiche au plus. Le champ `RessourceFiche.ouvrable` dit si
la personne lit le dossier lié. Sinon, `existe` et `lienWeb` valent null et le
serveur n'interroge pas le fournisseur (ADR 0039). L'export complet reprend la connexion
(sans jeton), les dossiers liés et les ressources. Les requêtes de l'espace de
fichiers rejoignent la relecture du flux des changements.
