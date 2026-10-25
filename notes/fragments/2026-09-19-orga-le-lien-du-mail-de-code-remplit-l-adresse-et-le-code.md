---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Le lien du mail de code remplit l'adresse et le code
  texte: >-
    Le bouton « Se connecter avec ce code » du mail ouvre l'espace
    organisateur avec l'adresse et le code déjà remplis. Dans l'onglet où
    vous avez demandé le code, la connexion part aussitôt. Auparavant, seul
    le code était rempli, et l'adresse seulement si elle avait été saisie
    dans le même onglet.
en:
  titre: >-
    The sign-in code email link fills in the email address and the code
  texte: >-
    The “Sign in with this code” button in the email opens the organizer
    workspace with the email address and the code already filled in. In the tab
    where you requested the code, sign-in starts immediately. Previously, only
    the code was filled in, and the email address only if it had been entered in
    the same tab.
---

- L'adresse rejoint le code dans le fragment du lien (`#code=…&adresse=…`),
  que le navigateur n'envoie jamais au serveur.
