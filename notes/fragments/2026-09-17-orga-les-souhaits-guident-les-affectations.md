---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Les souhaits guident les affectations
  texte: >-
    L'invitation d'une personne accepte un ou plusieurs périmètres souhaités.
    La page « Postes à pourvoir » affiche ces souhaits sur chaque périmètre,
    avec un bouton « Affecter ». La page des personnes montre les souhaits de
    l'édition choisie.
---

- admin/Postes : section « Intéressé·es » en liste HTML, bouton « Affecter »,
  retrait derrière un `Popconfirm` (désactivé sur une édition archivée),
  groupe « Intéressé·es » en tête du `Select` d'affectation, statistique
  « Souhaits en attente ».
- admin/Personnes : colonne « Souhaits » (`CheckOutlined` quand le souhait est
  satisfait), champ « Périmètres souhaités » groupé en Sports et Pôles pour
  l'édition choisie. Le champ est masqué pour une édition archivée et pour un
  compte archivé. `definirSouhaits` n'est appelé que si l'ensemble a changé.
