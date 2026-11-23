---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.38.0
fr:
  titre: >-
    L'agenda filtre les réunions
  texte: >-
    L'agenda affiche vos réunions : celles de l'agenda global, de vos
    périmètres et celles où vous êtes convoqué·e. La puce « Réunions » les
    affiche ou les masque, comme la puce « Échéances ». Les admins de
    l'activité disposent aussi d'une puce « Tous les périmètres », inactive à
    l'ouverture, qui ajoute les réunions et les échéances de chaque périmètre.
en:
  titre: >-
    The calendar filters meetings
  texte: >-
    The calendar shows your meetings: those of the global calendar, those of
    your areas and those you have a meeting notice for. The "Meetings" chip
    shows or hides them, like the "Due dates" chip. Activity admins also have
    an "All areas" chip, off when the screen opens, which adds the meetings and
    due dates of every area.
---

Puces de `pages/Agenda.tsx`. La règle `concerneLaPersonne` (`lib/agenda.ts`)
choisit les réunions de la liste, de la vue Mois et du panneau « Prochaine
réunion ». La puce « Tous les périmètres » ne se garde pas d'une visite à
l'autre. La requête `agenda` reçoit l'argument `tousLesPerimetres` : les
échéances de tous les périmètres non archivés de l'activité que la personne
lit, sans la limite de 60 identifiants de `perimetreIds`.
