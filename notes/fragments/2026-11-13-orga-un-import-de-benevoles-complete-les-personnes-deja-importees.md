---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Un import de bénévoles complète les personnes déjà importées
  texte: >-
    L'option « Mettre à jour les personnes déjà importées » retrouve chaque
    personne par son identifiant externe, comme un numéro de billet. Les
    champs vides de sa fiche se complètent et ses nouvelles séquences
    s'ajoutent. Une valeur déjà présente reste en place, et l'aperçu la
    signale. Une mise à jour n'envoie aucun mail, et une adresse ajoutée
    laisse « Prévenir par mail » décoché. Deux billets d'un même acheteur
    restent deux personnes, même avec la même adresse.
en:
  titre: >-
    A volunteer import completes the people already imported
  texte: >-
    The "Update people already imported" option finds each person by their
    external ID, such as a ticket number. The empty fields of their record are
    filled in and their new slots are added. A value already present stays in
    place, and the preview reports it. An update sends no email, and an added
    email address leaves "Notify by email" unchecked. Two tickets from the same
    buyer stay two people, even with the same email address.
---

ADR 0042, amendement du 2026-11-13. `lib/import-benevoles.ts` : `planifierMiseAJour`,
`lireCibles`, `appliquerMiseAJour` et l'argument `mettreAJour` de
`simulerImportBenevoles` et `importerBenevoles`. `lib/appels.ts` :
`accepterSurSequence` reporte l'option « Prévenir par mail » de l'import sur la
fiche née d'une candidature importée (nouvelle colonne `Candidature.prevenirParMail`)
et ne rattache plus une candidature importée à identifiant externe par l'adresse.
`commun/src/rapprochement.ts` : `regrouper` sépare deux identifiants externes.
