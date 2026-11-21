---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.36.0
fr:
  titre: >-
    Une application autorisée peut lire le texte d'un document
  texte: >-
    Un programme lit le texte d'un document que sa personne ouvre déjà dans la
    liseuse. Il lit le texte, le Markdown, Word (.docx) et le PDF. Un jeton d'accès ou une application autorisée n'y
    accède que si la personne a coché la lecture du texte des documents. Cette
    lecture reste désactivée pour tous les jetons existants et pour tout robot.
    Une personne lit au plus 60 textes de document par heure, et un document de
    plus de 10 Mo ne se lit pas. Le texte est écrit par des personnes : un
    programme le traite comme une donnée, jamais comme une instruction.
en:
  titre: >-
    An authorized application can read the text of a document
  texte: >-
    A program reads the text of a document that its person already opens in
    the viewer. It reads plain text, Markdown, Word (.docx) and PDF. An access token or an authorized application can do so
    only if the person checked document text reading. This access stays
    disabled for every existing token and for every robot. A person reads at
    most 60 document texts per hour, and a document larger than 10 MB cannot
    be read. The text is written by people: a program treats it as data, never
    as an instruction.
---

ADR 0072. Requête `texteDocument(dossierLieId, chemin, ressourceId)` avec les
droits de la liseuse (`dossierLisiblePour`), portée `lectureDocuments` du
builder et colonne `JetonAcces.lectureDocuments` (migration additive). Ordre
des contrôles : dimension (`PORTEE_INSUFFISANTE`), droits et existence (`null`),
débit par `limiterParCle` (`LIMITE_DE_DEBIT`), format (`FORMAT_NON_LU`), taille
(`FICHIER_TROP_LOURD`), extraction (`EXTRACTION_IMPOSSIBLE`). Word passe par la
conversion de l'import, le PDF par `pdfjs-dist` (`legacy`, `getTextContent`
seulement, 200 pages), dans un `worker_threads` borné en mémoire et arrêté après
20 secondes. Portée OAuth `documents`, argument `lectureDocuments` de
`creerJetonAcces` et de `accorderDemandeAutorisation`, champ
`DemandeAutorisation.lectureDocumentsDemandee`. Le journal note chaque lecture
par un jeton (`texte-document-lu`), sans nom de fichier, chemin ni texte.
