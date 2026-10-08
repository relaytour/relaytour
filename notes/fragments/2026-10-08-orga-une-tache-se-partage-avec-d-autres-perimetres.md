---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Une tâche se partage avec d'autres périmètres
  texte: >-
    Depuis la page de votre périmètre, vous déclinez une tâche dans d'autres
    périmètres de l'activité, à sa création ou depuis le menu « Autres
    actions ». Chaque périmètre choisi reçoit sa propre tâche, que ses
    référentes et référents acceptent ou refusent. Votre tâche indique où en
    sont ses déclinaisons, par exemple « 6 faites sur 9 ». Une tâche reçue
    indique le périmètre qui la demande. Les admins d'activité ajoutent une
    tâche à un périmètre sans attendre son accord. Le rétroplanning réunit sur
    une ligne les déclinaisons d'une même tâche qui tombent le même jour.
---

ADR 0026. Composants `DeclinaisonsTache`, `DeclinerTache`,
`DeclinaisonsProposees` et `ChoixPerimetresCibles`. Le serveur borne une
requête à 100 champs : le fragment `TacheChamps` reste inchangé, la page d'un
périmètre lit en plus l'origine et le résumé des déclinaisons, et les tâches
proposées comme le détail des déclinaisons se lisent par des requêtes à part.
« Mon espace » n'affiche donc pas le périmètre qui demande une tâche.
