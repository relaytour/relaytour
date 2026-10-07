---
cible: orga
type: correctif
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Les cartes de l'écran Équipe gardent leur place pendant les modifications
  texte: >-
    Sur l'écran Équipe, une affectation ne déplace plus la carte du périmètre :
    l'ordre se recalcule au chargement de la page. Le menu sépare la gestion de
    l'activité et celle de l'organisation. Les sections de la page Organisation
    sont espacées.
---

`lib/ordre.ts` : `usePremiereReception` garde l'ordre de première réception des
cartes, par période, et les cartes vues sous le filtre « À pourvoir ». `Coquille` :
groupes « Gérer l'activité » et « Gérer l'organisation ». Les modes d'emploi du
site citent ces deux groupes ; leurs captures restent à reprendre.
