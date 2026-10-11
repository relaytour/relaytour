---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Un refus de limite ou de lecture seule affiche son motif
  texte: >-
    Quand votre organisation a atteint une limite d'activités ou de périodes
    ouvertes, ou quand elle est en lecture seule, l'espace organisateur affiche
    maintenant le motif du refus et la personne à contacter. Il affichait
    auparavant un message d'échec sans explication.
---

`messageErreur` (`packages/orga/src/lib/erreurs.ts`) laisse passer le message des
codes `LIMITE_ATTEINTE` et `LECTURE_SEULE`, que le serveur compose pour la personne
(`packages/server/src/lib/erreurs.ts`, ADR 0008). Le message d'une limite cite
`CONTACT_HEBERGEUR` quand l'hébergeur l'a renseigné.
