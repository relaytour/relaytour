---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Une fiche d’un autre périmètre peut concerner aussi le vôtre
  texte: >-
    Une fiche peut concerner d’autres périmètres que le sien. Sa page indique
    les périmètres et les groupes qu’elle concerne. Dans un périmètre concerné,
    le panneau « Fiches connexes » la présente en lecture seule, avec son
    périmètre d’origine. Les référentes et référents de ce périmètre la masquent
    quand elle ne leur sert pas, puis l’affichent de nouveau. Dans le texte d’une
    fiche, une mention @périmètre ou @groupe:clé s’affiche comme une étiquette ;
    celle d’un groupe liste ses périmètres.
---

ADR 0039. `composants/FichesConnexes.tsx` (panneau du périmètre, masquage),
`composants/ConnexionsFiche.tsx` (panneau « À propos » de la fiche),
`lib/mentions.ts` (extension de remark, testée) et `composants/Mention.tsx`. La
requête `FichesDuPerimetre` lit les fiches connexes, masquées comprises : le
flux des fiches la relit déjà.
