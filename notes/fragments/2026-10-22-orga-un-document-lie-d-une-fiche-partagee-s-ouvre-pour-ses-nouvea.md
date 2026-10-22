---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Un document lié d'une fiche partagée s'ouvre pour ses nouveaux lecteurs
  texte: >-
    Quand une fiche concerne aussi d'autres périmètres, la personne qui la
    rédige voit quels documents liés ces périmètres n'ouvriront pas. L'éditeur
    l'annonce sous la liste « Concerne aussi », et le bouton d'alerte d'un
    document le détaille dans la fiche. Un admin de l'organisation étend alors
    le dossier lié aux périmètres et aux groupes de la fiche, ou ouvre ce seul
    document à toutes les personnes qui lisent la fiche.
---

ADR 0043 : champs `RessourceFiche.ouverteAuxLecteurs`, `ouverteParId` et
`ouverteLe`, mutation `ouvrirDocumentLie` réservée aux admins de
l'organisation, champ `RessourceFiche.perimetresSansAcces` lu par les personnes
qui rédigent la fiche. La route d'aperçu et `contenuDossierLie` acceptent
`ressource` : le chemin doit rester sous celui du document, et un fichier ne se
lit que lui-même. L'export complet reprend l'ouverture.
