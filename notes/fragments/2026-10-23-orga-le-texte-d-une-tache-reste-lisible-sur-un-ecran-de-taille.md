---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Le texte d'une tâche reste lisible sur un écran de taille moyenne
  texte: >-
    Sur une tablette, un petit ordinateur ou la page d'un périmètre avec son
    panneau latéral, les boutons d'une tâche s'affichent désormais en colonne
    à droite. Le titre et la description de la tâche disposent ainsi de plus
    de largeur. Sur un téléphone, les boutons restent alignés sous la tâche.
---

Requête de conteneur `carte-tache` sur `.rt-carte-tache` : en dessous de
960 pixels de large, `.rt-carte-tache-actions` passe en colonne et le bouton
« Autres actions » se range à droite. La règle du téléphone (moins de
768 pixels d'écran) rétablit la ligne sous le contenu. Mesure sur la page
d'un périmètre, écran de 860 pixels : le texte passe de 408 à 526 pixels de
large.
