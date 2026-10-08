---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    Une activité déclare ses phases
  texte: >-
    Le fichier `activite.yaml` d'un dossier de contenu accepte une clé `phases`.
    Chaque phase porte une clé, un libellé et une borne en jours depuis le
    premier jour de la période, par exemple `J-120`. La dernière phase ne porte
    pas de borne. Une activité qui ne déclare rien garde quatre phases par
    défaut. L'import écrit les phases en base et l'export les réécrit. Une
    tâche ne déclare pas sa phase : elle s'y range par son échéance.
---

ADR 0025. Colonne `Activite.phases` (JSON, nulle par défaut), schéma
`PhasesSchema` dans `packages/server/src/lib/phases.ts`, partagé par le contenu
et par les mutations `creerActivite` et `modifierActivite`. Le contrat GraphQL
gagne `Phase`, `PhaseInput` et `Activite.phases`. La disposition plate du
contenu ne décrit pas de phases.
