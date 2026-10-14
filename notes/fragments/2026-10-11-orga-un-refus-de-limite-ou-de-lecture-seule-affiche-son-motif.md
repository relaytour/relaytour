---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.17.0
fr:
  titre: >-
    Un refus de limite ou de lecture seule affiche son motif
  texte: >-
    Quand votre organisation atteint une limite d'activités ou de périodes
    ouvertes, l'espace organisateur affiche maintenant le motif du refus. Il
    indique aussi qui contacter : l'hébergeur s'il est renseigné, sinon un admin
    de votre organisation. Quand votre organisation est en lecture seule, il
    rappelle que ses données restent consultables et exportables. Il affichait
    auparavant un message d'échec sans explication.
---

`messageErreur` (`packages/orga/src/lib/erreurs.ts`) laisse passer le message des
codes `LIMITE_ATTEINTE` et `LECTURE_SEULE`, que le serveur compose pour la personne
(`packages/server/src/lib/erreurs.ts`, ADR 0008). Le message d'une limite cite
`CONTACT_HEBERGEUR` quand l'hébergeur l'a renseigné, sinon un admin de
l'organisation. Le message de la lecture seule ne cite aucun contact.
