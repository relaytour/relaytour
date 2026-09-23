---
cible: orga
type: correctif
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Mon espace masque les actions sur une tâche que vous ne pouvez plus modifier
  texte: >-
    Une tâche vous reste assignée après le retrait de votre affectation au
    périmètre. Mon espace affichait alors les boutons « Faite », « Me retirer »
    et le menu « Autres actions », et le serveur refusait l'action. Ces boutons
    ne s'affichent plus, comme sur la page d'un périmètre.
---

L'API expose `peutModifier` sur la tâche, sans argument : la tâche porte son
périmètre et son édition. Le champ reprend `peutModifierPerimetre`, la règle
qu'applique déjà `perimetre.peutModifier`. `MonEspace` le passe aux cartes à la
place de la valeur codée en dur. `editionEtPerimetre` garde son résultat par
requête : une liste de tâches interroge le même couple périmètre et édition.
