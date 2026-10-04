---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Les souhaits se notent dans chaque activité
  texte: >-
    Dans une organisation qui porte plusieurs activités, la fenêtre
    d'invitation et de modification d'un compte propose un champ de souhaits
    par activité que vous administrez. Chaque champ porte sur l'édition en
    cours de son activité et liste ses propres périmètres. Auparavant, seuls
    les périmètres de l'activité affichée étaient proposés.
---

`ChampSouhaits` lit l'édition en cours et les périmètres de son activité
(`editionCourante(activiteId)`, `perimetres(activiteId)`). L'activité affichée
garde l'édition choisie sur la page et les souhaits déjà lus par la liste ; elle
n'a pas de champ quand cette édition est archivée. Une autre activité lit les
souhaits de son édition à chaque ouverture. L'invitation porte les souhaits de la
première édition renseignée ; les autres passent par `definirSouhaits` une fois le
compte créé. Si cette suite échoue, la fenêtre passe en modification du compte créé
et garde la saisie. Le serveur ne change pas.
