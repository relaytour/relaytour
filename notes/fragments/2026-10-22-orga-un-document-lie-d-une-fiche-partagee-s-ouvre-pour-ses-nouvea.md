---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.20.0
fr:
  titre: >-
    Un admin ouvre un document lié aux lecteurs d'une fiche partagée
  texte: >-
    Quand une fiche concerne aussi d'autres périmètres, la personne qui la
    rédige voit quels documents liés ces périmètres n'ouvriront pas.
    L'avertissement s'affiche sous la liste « Concerne aussi » de l'éditeur.
    Dans la fiche, vous lisez le détail par le bouton d'alerte du document. Un
    admin de l'organisation étend alors le dossier lié aux périmètres et aux
    groupes de la fiche. Il peut aussi ouvrir ce seul document à toutes les
    personnes qui lisent la fiche.
en:
  titre: >-
    An admin opens a linked document to the readers of a shared sheet
  texte: >-
    When a sheet also concerns other areas, the person who writes it sees which
    linked documents those areas cannot open. The warning appears below the
    “Also concerns” list in the editor. In the sheet, you read the details with
    the alert button on the document. An organization admin can then extend the
    linked folder to the areas and groups of the sheet. They can also open that
    one document to everyone who reads the sheet.
---

ADR 0043 : champs `RessourceFiche.ouverteAuxLecteurs`, `ouverteParId` et
`ouverteLe`, mutation `ouvrirDocumentLie` réservée aux admins de
l'organisation, champ `RessourceFiche.perimetresSansAcces` lu par les personnes
qui rédigent la fiche. La route d'aperçu et `contenuDossierLie` acceptent
`ressource` : le chemin doit rester sous celui du document, et un fichier ne se
lit que lui-même. L'export complet reprend l'ouverture.
