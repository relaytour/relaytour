---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
version: 0.9.0
fr:
  titre: >-
    Vous consultez les tâches des autres périmètres de votre activité
  texte: >-
    Dès votre première affectation dans une activité, vous ouvrez chaque
    périmètre de cette activité depuis « Tous les périmètres ». Vous y lisez
    les tâches, l'avancement, les retards et les personnes affectées. Vous ne
    pouvez rien y modifier, et les fiches restent réservées aux personnes
    affectées au périmètre. Le rétroplanning couvre désormais toute
    l'activité : la bascule « Mes périmètres » le ramène à vos périmètres. La
    page d'un périmètre et le rétroplanning filtrent aussi les tâches en
    retard.
---

`Perimetre.tsx` lit `Perimetre.acces`. En consultation, la page affiche un
bandeau, masque le panneau des fiches et ne demande plus `fiches`, que le
serveur refuse : la requête `FichesDuPerimetre` ne part qu'avec un accès complet.
`TousLesPerimetres.tsx` ajoute le lien « Consulter les tâches », sauf en
découverte. Le menu sélectionne « Tous les périmètres » sur la page d'un
périmètre hors du menu. ADR 0014.
