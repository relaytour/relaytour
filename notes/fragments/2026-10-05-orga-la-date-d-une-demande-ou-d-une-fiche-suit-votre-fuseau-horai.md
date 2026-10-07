---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.9.0
fr:
  titre: >-
    La date d'une demande ou d'une fiche suit votre fuseau horaire
  texte: >-
    L'onglet « Demandes » de « Personnes », la liste des fiches et le panneau
    « Contenu de l'organisation » calculaient le jour d'après l'heure
    universelle (UTC). En France, une demande déposée entre minuit et 2 h
    s'affichait avec la date de la veille. Ces écrans affichent désormais le
    jour dans le fuseau horaire de votre navigateur. Les échéances des tâches et
    les dates des périodes ne changent pas.
---

`dateCourte` (`lib/erreurs.ts`) garde les dix premiers caractères de la chaîne :
elle convient à un scalaire `Date`. Quatre appels lui passaient un `DateTime` :
`Demandes` (`creeLe`), `Fiches` (`modifieeLe`) et `Organisation`
(`contenuModifieLe`, `contenuSynchroniseLe`). `jourDeLInstant` passe par
`new Date(iso)` et formate le jour dans le fuseau du navigateur, comme `ilYA`
(`Notifications`) et `dateHeure` (`Fiche`). Son second paramètre fixe le fuseau
dans les tests. Le serveur ne change pas.
