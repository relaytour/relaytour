---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.32.0
fr:
  titre: >-
    Une réunion passée s'affiche terminée, et porte son compte rendu
  texte: >-
    Une réunion dont la fin est passée s'affiche « Terminée » dans l'agenda et
    dans son volet, sans aucun geste. Elle ne se modifie plus et ne s'annule
    plus : personne ne reçoit de convocation ni d'annulation par erreur. Les
    personnes qui écrivent dans son agenda y lient la fiche de compte rendu,
    une fiche commune ou une fiche du périmètre, sans envoyer de mail.
en:
  titre: >-
    A past meeting shows as ended and links its minutes
  texte: >-
    A meeting whose end has passed shows as "Ended" in the calendar and in its
    panel, without any action. It can no longer be edited or canceled, so
    nobody receives a notice or a cancellation by mistake. The people who write
    in its calendar link its minutes sheet, a shared sheet or a sheet of the
    area, without sending any email.
---

ADR 0066. État déduit `etatReunion` et `exigerNonTerminee`
(`server/src/lib/reunions.ts`) ; section « Compte rendu » de
`orga/src/composants/ReunionDetail.tsx`.
