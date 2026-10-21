---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Les bénévoles se proposent par l'adresse publique d'un appel
  texte: >-
    Une séquence du programme indique les renforts qu'elle recherche et des
    consignes publiques. Vous ouvrez un appel sur votre périmètre ou sur une
    séquence, puis vous diffusez son adresse. Les admins de l'activité ouvrent
    aussi un appel sur toute la période. Les bénévoles y
    choisissent des séquences et donnent leurs disponibilités. Vous acceptez ou
    refusez chaque séquence dans l'onglet « Candidatures » de l'écran
    « Bénévoles ». Aucun mail ne part au dépôt.
---

ADR 0041 : `AppelBenevoles`, `Candidature`, `ChoixCandidature`,
`PlageDisponibilite` ; requêtes `appelsBenevoles`, `candidatures`,
`appelBenevolesPublic` ; mutations des appels, `deposerCandidature`,
`accepterChoixCandidature`, `refuserChoixCandidature`, `refuserCandidature` ;
notification `CANDIDATURE_RECUE` ; entité de flux `CANDIDATURE`.
