---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    L'agenda affiche la prochaine réunion en tête
  texte: >-
    Un panneau en haut de l'agenda présente votre prochaine réunion, dans la
    vue Liste comme dans la vue Mois. Il indique le jour, l'horaire, le lieu et
    votre réponse à la convocation. Le bouton « Rejoindre la visio » ouvre le
    lien de la réunion.
en:
  titre: >-
    The calendar shows the next meeting at the top
  texte: >-
    A panel at the top of the calendar shows your next meeting, in the List
    view and in the Month view. It gives the day, the time, the place and your
    reply to the meeting notice. The "Join the video call" button opens the
    meeting link.
---

Panneau « Prochaine réunion » de `pages/Agenda.tsx`, choisi par
`prochaineReunion` (`lib/agenda.ts`) : la première réunion à l'état `PREVUE`
de l'agenda global, d'un périmètre de la personne ou d'une convocation. Une
réunion commencée reste affichée jusqu'à sa fin, avec la pastille « En cours ».
Le panneau se replie comme les groupes de l'agenda. Aucun changement du
serveur.
