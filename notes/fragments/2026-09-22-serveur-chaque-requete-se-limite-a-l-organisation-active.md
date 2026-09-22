---
cible: serveur
type: interne
audience: interne
etat: prevu
fr:
  titre: >-
    Chaque requête se limite à l'organisation active
  texte: >-
    Le contexte porte l'organisation active, choisie par un en-tête ou par
    l'unique appartenance de la personne. Le rôle d'admin vaut dans cette
    organisation. Toute lecture et toute écriture se limitent à ses données, et
    une organisation en lecture seule refuse les modifications. Les activités
    se lisent et se gèrent par l'API, dans les limites fixées par
    l'hébergeur.
---

- Scopes `connecte`, `admin` et `ecriture` ; le type Mutation exige `ecriture`
  (code `LECTURE_SEULE`). Organisation suspendue ou archivée : aucun contexte.
- `ctx.exigerActivite()` et `ctx.exigerEdition()` ; un identifiant inconnu et
  un identifiant d'une autre organisation donnent le même refus.
- Arguments `activiteId` facultatifs sur les périodes, périmètres, fiches et
  créations ; sans eux, la première activité de l'organisation.
- Requête `activites`, mutations `creerActivite`, `modifierActivite`,
  `archiverActivite` ; champs `Edition.activite`, `Perimetre.activite`,
  `Perimetre.groupe`.
- Limites `activites` et `periodesOuvertes` (code `LIMITE_ATTEINTE`), variable
  `CONTACT_HEBERGEUR`.
- Migration `droits_redaction_organisation`. Invitation d'un compte connu
  d'une autre organisation par appartenance.
- Fichier `organisations.integration.test.ts` : refus entre organisations,
  entre activités, lecture seule, suspension, limites.
