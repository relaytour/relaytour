---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Les rappels et les résumés suivent chaque organisation
  texte: >-
    Chaque organisation reçoit ses rappels d'échéance et ses résumés à l'heure
    de son fuseau. Un mail porte le nom et les couleurs de son organisation.
    Une personne membre de plusieurs organisations reçoit le résumé de
    chacune, limité à ses tâches et à ses notifications.
en:
  titre: >-
    Reminders and digests follow each organization
  texte: >-
    Each organization receives its due date reminders and digests at the time of
    its own time zone. An email carries the name and colors of its organization.
    A person who belongs to several organizations receives the digest of each,
    limited to their tasks and notifications.
---

- Le worker crée un scheduler `rappels` et `resumes` par organisation active,
  dans son fuseau, au démarrage puis chaque heure (`synchro`). Les
  planifications globales d'avant disparaissent.
- `genererRappels` et `personnesAResumer` reçoivent l'organisation ;
  `aujourdhuiParis` devient `aujourdhui(maintenant, fuseau)`. Le retard, le
  score et l'avancement lisent le fuseau de l'organisation.
- Les jobs de mail portent `organisationId`. Migration
  `resumes_par_organisation`.
- `planification:lancer` reçoit `--organisation` et accepte `synchro`.
- `organisationParDefaut()` n'a plus d'appel en production ; un test le
  vérifie.
