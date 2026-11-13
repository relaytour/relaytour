---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.31.0
fr:
  titre: >-
    Un import de bénévoles retire les billets annulés et reconnaît leur remplacement
  texte: >-
    Une colonne « Annulation du billet » signale les billets annulés. Avec
    l'option « Mettre à jour les personnes déjà importées », la candidature
    d'un billet annulé se retire, et la fiche reste. L'aperçu liste les places
    que ce billet tient encore, et une seconde option les retire. Quand une
    personne prend un nouveau billet, l'aperçu propose « Remplace le billet » :
    le nouveau billet rejoint la fiche de l'ancien, sans aucun mail. Un billet
    absent du fichier est seulement signalé.
en:
  titre: >-
    A volunteer import withdraws cancelled tickets and recognizes their replacement
  texte: >-
    A "Ticket cancellation" column reports cancelled tickets. With the "Update
    people already imported" option, the application of a cancelled ticket is
    withdrawn, and the record stays. The preview lists the places this ticket
    still holds, and a second option removes them. When a person takes a new
    ticket, the preview suggests "Replaces ticket": the new ticket joins the
    record of the old one, without any email. A ticket missing from the file is
    only reported.
---

ADR 0042, second amendement du 2026-11-13. Champ `ANNULATION` et
`proposerRemplacements` (`orga/src/lib/import-benevoles.ts`) ; état `ANNULEE`,
`placesDesAnnulations`, arguments `annulee`, `remplace` et `retirerPlacesAnnulees`,
requête `refsImportees` (`server/src/lib/import-benevoles.ts`).
