---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.13.0
fr:
  titre: >-
    Le code de connexion se saisit plus vite sur un téléphone
  texte: >-
    L'écran de connexion ouvre le clavier numérique, et le téléphone propose le
    code reçu quand il le reconnaît.
en:
  titre: >-
    The sign-in code is quicker to enter on a phone
  texte: >-
    The sign-in screen opens the numeric keypad, and the phone suggests the code
    it received when it recognizes it.
---

Lot 2 de l'ADR 0023. `Input.OTP` reçoit `inputMode="numeric"` et
`autoComplete="one-time-code"`. `lib/installation.ts` détecte l'application
installée, où l'écran rappelle de saisir le code.
