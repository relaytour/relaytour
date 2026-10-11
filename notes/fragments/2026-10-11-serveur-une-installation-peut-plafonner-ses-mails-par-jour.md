---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    Une installation peut plafonner ses mails par jour
  texte: >-
    La variable facultative `COURRIEL_PLAFOND_QUOTIDIEN` fixe le nombre de mails
    qu'une installation envoie par jour. Au-delà, le worker reporte le mail au
    lendemain. Le code de connexion part toujours. Sans cette variable, rien ne
    change.
---

ADR 0031. Le compteur vit dans Redis, par jour UTC (`lib/plafond-courriel.ts`). Le
processeur des mails réserve une place avant l'envoi, la rend après une panne du
transport, et journalise chaque report (`courriel-plafond-atteint`). La pile de
référence passe la variable au worker.
