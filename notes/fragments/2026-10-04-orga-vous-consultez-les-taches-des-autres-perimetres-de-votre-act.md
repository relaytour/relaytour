---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
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
en:
  titre: >-
    You view the tasks of the other areas in your activity
  texte: >-
    As soon as you have your first appointment in an activity, you can open
    every area of that activity from “All areas”. You read the tasks, the
    progress, the overdue tasks, and the people appointed. You cannot edit
    anything there, and sheets stay reserved for people appointed to the area.
    The timeline now covers the whole activity: the “My areas” toggle brings it
    back to your areas. An area’s page and the timeline also filter overdue
    tasks.
---

`Perimetre.tsx` lit `Perimetre.acces`. En consultation, la page affiche un
bandeau, masque le panneau des fiches et ne demande plus `fiches`, que le
serveur refuse : la requête `FichesDuPerimetre` ne part qu'avec un accès complet.
`TousLesPerimetres.tsx` ajoute le lien « Consulter les tâches », sauf en
découverte. Le menu sélectionne « Tous les périmètres » sur la page d'un
périmètre hors du menu. ADR 0014.
