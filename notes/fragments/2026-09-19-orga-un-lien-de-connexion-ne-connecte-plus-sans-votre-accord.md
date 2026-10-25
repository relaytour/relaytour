---
cible: orga
type: securite
audience: organisateurs
role: referent
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Un lien de connexion ne connecte plus sans votre accord
  texte: >-
    Le lien du mail de code vous connecte sans clic seulement dans l'onglet où
    vous avez demandé le code, avec la même adresse. Ouvert ailleurs, il
    préremplit l'adresse et le code, et vous validez vous-même. Un lien forgé
    par une autre personne ne peut plus vous connecter à son compte à votre
    insu.
en:
  titre: >-
    A sign-in link no longer signs you in without your consent
  texte: >-
    The link in the sign-in code email signs you in without a click only in the
    tab where you requested the code, with the same email address. Opened
    elsewhere, it prefills the email address and the code, and you confirm
    yourself. A link forged by someone else can no longer sign you in to their
    account without your knowledge.
---

- `adresseConnexionAutomatique` (`src/lib/connexion.ts`) compare l'adresse du lien à l'adresse mémorisée dans `sessionStorage`, sans tenir compte de la casse.
- Sans adresse dans le lien, l'adresse mémorisée sert, comme avant.
