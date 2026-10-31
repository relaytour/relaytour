---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    Un admin télécharge l'export complet de son organisation, même en lecture seule
  texte: >-
    La page « Organisation » propose « Télécharger l'export complet (JSON) ». Le
    fichier contient les activités, les périodes, les fiches avec leur historique,
    les tâches, les membres et leurs affectations. L'export reste possible quand
    l'organisation est en lecture seule, par exemple après la fin d'un essai.
en:
  titre: >-
    An admin downloads the full export of their organization, even when it is read-only
  texte: >-
    The "Organization" page offers "Download the full export (JSON)". The file
    contains the activities, periods, sheets with their history, tasks, members,
    and their appointments. The export remains available when the organization is
    read-only, for example after a trial ends.
---

ADR 0055. Nouvelle requête `exportOrganisation`, réservée aux admins de
l'organisation, qui rend le JSON de `construireExport` (ADR 0008). Une requête
n'exige pas le droit d'écriture : la lecture seule ne la bloque pas.
