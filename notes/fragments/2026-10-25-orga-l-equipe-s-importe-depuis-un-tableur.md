---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    L’équipe d’une édition s’importe depuis un tableur
  texte: >-
    Le bouton « Importer une liste » de l’écran Personnes lit un fichier CSV ou
    Excel : nom, adresse, périmètres et contact principal. L’import vérifie
    chaque ligne, puis crée les comptes, les rattachements et les affectations
    qui manquent, sans rien retirer. Une personne sans périmètre rejoint
    l’équipe de l’activité. Aucun mail ne part, sauf si vous cochez « Envoyer
    les invitations ».
en:
  titre: >-
    An edition’s team can be imported from a spreadsheet
  texte: >-
    The “Import a list” button of the People screen reads a CSV or Excel file:
    name, address, areas, and main contact. The import checks each row, then
    creates the missing accounts, affiliations, and appointments, without
    removing anything. A person without an area joins the activity’s team. No
    email is sent unless you check “Send the invitations”.
---

ADR 0049. Requête `simulerImportEquipe` et mutation `importerEquipe`
(`packages/server/src/lib/import-equipe-tableur.ts`), sur l'import d'équipe de la
commande (ADR 0013). Le rapport ne donne que des nombres (ADR 0018).
