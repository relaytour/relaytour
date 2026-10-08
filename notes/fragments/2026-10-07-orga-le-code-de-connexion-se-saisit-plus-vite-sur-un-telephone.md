---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Le code de connexion se saisit plus vite sur un téléphone
  texte: >-
    L'écran de connexion ouvre le clavier numérique, et le téléphone propose le
    code reçu quand il le reconnaît.
---

Lot 2 de l'ADR 0023. `Input.OTP` reçoit `inputMode="numeric"` et
`autoComplete="one-time-code"`. `lib/installation.ts` détecte l'application
installée, où l'écran rappelle de saisir le code.
