---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.30.0
fr:
  titre: >-
    Les notifications ne gardent par défaut que ce qui vous concerne
  texte: >-
    La cloche ne montre plus par défaut toute l'activité de vos périmètres. Elle
    garde vos tâches, vos échéances, vos réunions et les décisions qui vous
    attendent. Dans « Préférences », un modèle de notifications règle vos mails et
    vos notifications en un geste : Essentiel, Référent·e, Contact principal ou
    Admin d'activité. Le modèle de votre rôle y est recommandé. Vous pouvez ensuite
    suivre l'essentiel ou tout le détail de vos périmètres. Le contact principal
    d'un périmètre reçoit en premier les déclinaisons à accepter et les retards des
    tâches sans personne.
en:
  titre: >-
    Notifications now keep only what concerns you by default
  texte: >-
    By default, the bell no longer shows all the activity of your areas. It keeps
    your tasks, your deadlines, your meetings and the decisions waiting for you. In
    "Preferences", a notification preset sets your emails and notifications in one
    step: Essential, Coordinator, Main contact or Activity admin. The preset for
    your role is recommended there. You can then follow the essentials or every
    detail of your areas. The main contact of an area is the first to receive
    derived tasks to approve and overdue tasks with nobody assigned.
---

ADR 0065, lot 1. `PreferenceOrganisation` gagne `suiviPerimetres`,
`detailContactPrincipal` et `suiviAdmin`, qui remplacent `applicationPerimetre` et
`applicationEquipe` (gardées en base). `lib/importance-notifications.ts` classe chaque
notification, `lib/modeles-notification.ts` porte les modèles. La migration fait un
rattrapage par rôle : modèle Admin d'activité pour les admins, Contact principal pour
les contacts principaux d'une période non archivée, Essentiel pour les autres.
