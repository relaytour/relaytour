---
cible: serveur
type: correctif
audience: public
etat: prevu
version: 0.18.0
fr:
  titre: >-
    Le code de connexion compte dans le plafond des mails et passe en tête de la file
  texte: >-
    Le code de connexion entre désormais dans le plafond quotidien des mails,
    sans jamais être reporté. Le total du jour reste ainsi sous le quota du
    fournisseur de mail, qui pourrait sinon bloquer tous les envois. Le code
    passe aussi devant les autres mails de la file : il arrive avant d'expirer,
    même après l'invitation d'une longue liste. Gardez un écart entre
    `COURRIEL_PLAFOND_QUOTIDIEN` et le quota de votre fournisseur.
---

ADR 0034 révisée. `SORTES_HORS_PLAFOND` devient `SORTES_JAMAIS_REPORTEES` :
`reserverEnvoi` compte ces sortes et les laisse partir au-delà du plafond, et
`rendreEnvoi` rend leur place après une panne. `mettreEnFile` pose la priorité
BullMQ 10 sur chaque mail sauf le code de connexion, et BullMQ traite d'abord les
jobs sans priorité.
