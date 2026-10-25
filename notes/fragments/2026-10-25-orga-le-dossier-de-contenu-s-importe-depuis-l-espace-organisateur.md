---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Le dossier de contenu s’importe depuis l’espace organisateur
  texte: >-
    Les admins de l’organisation déposent l’archive zip du contenu sur la page
    Organisation, à côté de son téléchargement. Les admins d’une activité
    déposent le dossier de leur activité sur la page Activités : l’import ne lit
    que ce dossier. L’archive est vérifiée avant tout import, et le rapport
    indique les périmètres et les fiches créés ou modifiés. Une modification
    faite dans l’application depuis le dernier export demande une confirmation
    avant d’être remplacée. Une fiche modifiée dans Relaytour n’est jamais
    remplacée.
en:
  titre: >-
    The content folder can be imported from the organiser space
  texte: >-
    Organisation admins upload the content zip archive on the Organisation page,
    next to its download. Activity admins upload their activity’s folder on the
    Activities page: the import only reads that folder. The archive is checked
    before any import, and the report lists the areas and sheets that are
    created or changed. A change made in the application since the last export
    asks for a confirmation before it is replaced. A sheet changed in Relaytour
    is never replaced.
---

ADR 0049. Route `POST /medias/contenu/depot` (`packages/server/src/orga/route-depot-contenu.ts`) :
une requête GraphQL est bornée à 1 Mo. Lecture de l'archive en mémoire dans
`lib/zip.ts` (20 Mo, 50 Mo décompressés, 2 000 fichiers, ni zip64 ni chiffrement),
composition du dossier dans `orga/depot-contenu.ts`, option `ignorerOrganisation`
d'`importerModeles`.
