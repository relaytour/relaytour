---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Les admins assignent une tâche à une autre personne
  texte: >-
    Sur la carte d'une tâche, les admins choisissent une personne parmi les référentes et
    référents du périmètre. Les admins peuvent aussi retirer une
    personne de la tâche. La personne concernée le voit dans ses notifications.
---

La mutation assignerTache acceptait déjà personneId pour les admins ; seul l'écran
manquait. TacheCarte reçoit la prop estAdmin (lue dans la requête Moi) : les tags des
personnes assignées deviennent fermables et une liste propose les référent·es non
assigné·es. Le bouton « Je m’en occupe » est masqué pour une personne non affectée
au périmètre, car le serveur refuserait l'assignation.
