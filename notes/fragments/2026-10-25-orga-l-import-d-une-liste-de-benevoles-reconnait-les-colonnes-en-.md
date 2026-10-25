---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    L’import d’une liste de bénévoles reconnaît les colonnes en anglais
  texte: >-
    L’assistant d’import associe aussi les colonnes d’un fichier en anglais,
    comme le nom de famille, les disponibilités, les postes ou la date
    d’inscription. Il écarte aussi les colonnes sensibles en anglais, comme le
    genre, la santé ou le montant payé. Une séquence se reconnaît aussi sous la
    forme « 18:00 to 19:00 ».
en:
  titre: >-
    The volunteer list import recognizes English column headers
  texte: >-
    The import wizard also maps the columns of a file in English, such as the
    surname, availability, positions, or registration date. It also sets aside
    sensitive columns in English, such as gender, health, or the amount paid. A
    slot is also recognized in the form “18:00 to 19:00”.
---

ADR 0042. Synonymes anglais dans `SYNONYMES` et `SENSIBLES` de
`packages/orga/src/lib/import-benevoles.ts`, « to » accepté par `HORAIRE`. Le fichier
d’essai `essais-import/ticketing.csv` et son test couvrent ces en-têtes.
