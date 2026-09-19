---
cible: orga
type: correctif
audience: public
etat: prevu
fr:
  titre: >-
    Le lien du mail de code remplit l'adresse et le code
  texte: >-
    Le bouton « Se connecter avec ce code » du mail ouvre l'espace
    organisateur avec l'adresse et le code déjà remplis. Dans l'onglet où
    vous avez demandé le code, la connexion part aussitôt. Auparavant, seul
    le code était rempli, et l'adresse seulement si elle avait été saisie
    dans le même onglet.
---

- L'adresse rejoint le code dans le fragment du lien (`#code=…&adresse=…`),
  que le navigateur n'envoie jamais au serveur.
