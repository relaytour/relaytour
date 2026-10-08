---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.14.0
fr:
  titre: >-
    L'API propose, accorde et impose une déclinaison
  texte: >-
    Une personne qui écrit dans un périmètre crée une tâche partagée et la
    propose à d'autres périmètres de l'activité. Chaque déclinaison attend
    l'accord du périmètre cible, qui l'accepte ou la refuse. Tant qu'elle n'est
    pas acceptée, elle ne compte ni dans ses tâches, ni dans son avancement, ni
    dans les rappels, ni dans le score. Un admin de l'activité ajoute une
    déclinaison sans accord, et impose une déclinaison refusée. Une tâche lit
    le résumé de ses déclinaisons, et les admins lisent l'historique de chaque
    accord.
---

ADR 0026. Mutations `creerTache(declinaison:)`, `declinerTache`,
`accorderDeclinaison` et `imposerDeclinaison`. Champs `Tache.origine`,
`declinaisons`, `accord`, `resumeDeclinaisons` et `historiqueAccord`, champ
`Perimetre.declinaisonsProposees`, requête `tache(id)`. Le détail des
déclinaisons se lit sur une seule tâche : dans une liste, le plafond de
complexité des requêtes le refuse. Types de journal `DECLINAISON_*`, types de
notification `DECLINAISON_PROPOSEE`, `DECLINAISON_ACCEPTEE` et
`DECLINAISON_REFUSEE`, dans l'application seulement. Une déclinaison ne donne
aucun point de création.
