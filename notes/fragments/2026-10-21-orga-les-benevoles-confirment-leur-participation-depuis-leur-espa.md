---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.19.0
fr:
  titre: >-
    Les bénévoles confirment leur participation depuis leur espace
  texte: >-
    La première place d'une fiche bénévole envoie un seul mail, avec un lien
    personnel qui reste le même. Ce lien ouvre l'espace de la personne : elle y
    relit ses places et ses disponibilités, confirme sa participation, ajoute
    ses places à son agenda ou quitte une place. Vous copiez ce lien depuis la fiche pour l'envoyer par SMS. L'option
    « Prévenir par mail » d'une fiche coupe ces mails.
en:
  titre: >-
    Volunteers confirm their participation from their own page
  texte: >-
    A volunteer record’s first place sends a single email with a personal link
    that stays the same. This link opens the person’s page, where they review
    their places and availability, confirm their participation, add their places
    to their calendar, or leave a place. You copy this link from the record to
    send it by text message. The “Notify by email” option on a record turns
    these emails off.
---

ADR 0041 : `espaceBenevole`, `confirmerParticipation`, `quitterPlace`,
`supprimerMaFiche`, `renvoyerLienBenevole`, `lienEspaceBenevole` ; gabarits
`benevole-lien` et `benevole-places` ; notification `BENEVOLE_RETIRE`.
