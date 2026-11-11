---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.30.0
fr:
  titre: >-
    Une correction rapide d'une tâche ne notifie plus personne
  texte: >-
    Les notifications d'une tâche attendent la fin d'une fenêtre de dix minutes.
    Une personne retirée puis remise sur la tâche, ou un statut revenu à sa valeur
    de départ, ne notifie plus personne. Plusieurs modifications de la même tâche
    donnent une seule notification et un seul mail. Le push et le mail d'une
    tâche partent donc au plus dix minutes après l'action. Un commentaire reste
    annoncé tout de suite.
en:
  titre: >-
    A quick correction to a task no longer notifies anyone
  texte: >-
    Task notifications wait for the end of a ten-minute window. A person removed
    and then put back on the task, or a status set back to its starting value, no
    longer notifies anyone. Several changes to the same task give a single
    notification and a single email. Task push notifications and emails therefore
    go out at most ten minutes after the action. A comment is still announced
    straight away.
---

ADR 0065, lot 2. `Notification` gagne `disponibleLe` et `mailEnAttente`, `Journal`
gagne `statutPrecedent`. `lib/fenetre-notifications.ts` porte la fenêtre et le job
`consolider-tache` de la file `planification`. La cloche, son nombre, le push et le
résumé ignorent une notification en attente.
