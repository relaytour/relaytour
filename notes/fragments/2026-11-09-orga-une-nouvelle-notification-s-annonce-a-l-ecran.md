---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.30.0
fr:
  titre: >-
    Une nouvelle notification s'annonce à l'écran
  texte: >-
    Une notification qui arrive pendant que l'espace est ouvert s'annonce par un
    avis discret, en bas de l'écran. Un clic sur l'avis ouvre la tâche ou l'objet
    concerné et marque la notification comme lue. « Voir dans la cloche » ouvre la
    cloche. Si vous êtes en train d'écrire une fiche, une tâche ou un commentaire,
    l'espace vous demande de confirmer avant de quitter la page.
en:
  titre: >-
    A new notification shows up on screen
  texte: >-
    A notification that arrives while the space is open shows up as a discreet
    notice at the bottom of the screen. A click on the notice opens the task or
    item concerned and marks the notification as read. "See in the bell" opens the
    bell. If you are writing a sheet, a task or a comment, the space asks you to
    confirm before leaving the page.
---

ADR 0065, lot 5. Composant `AvisNotifications` dans la coquille, registre
`lib/modifications-en-cours.ts`, navigation protégée (`composants/navigation-protegee.ts`)
utilisée aussi par la cloche, événement `lib/cloche.ts` pour ouvrir le tiroir.
