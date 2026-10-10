---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Chaque tâche porte un fil de commentaires
  texte: >-
    Le bouton « Commenter » d'une tâche ouvre son fil. Vous y écrivez un compte
    rendu, une information ou une question, avec votre nom et la date. Le fil
    montre aussi l'historique de la tâche : création, modifications, assignations
    et changements de statut. Une adresse web écrite dans un commentaire devient
    un lien. Les personnes assignées à la tâche reçoivent une notification, sans
    mail immédiat. Vous modifiez et supprimez vos propres commentaires.
---

ADR 0029. `FilTache` lit `filTache` à l'ouverture du volet ; la carte lit le
nombre de commentaires par `commentairesDeLaPeriode`. `lib/liens.ts` découpe les
adresses : une adresse de l'espace organisateur s'ouvre dans le même onglet, une
autre adresse dans un nouvel onglet.
