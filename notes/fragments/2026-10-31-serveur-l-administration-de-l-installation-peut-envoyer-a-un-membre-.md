---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    L'administration de l'installation peut envoyer à un membre le rappel de ses espaces
  texte: >-
    La mutation `rappelerAdresses(courriel)` de l'API d'administration transmet une
    adresse à l'installation. Si l'adresse appartient à un membre actif, l'installation
    lui envoie l'adresse de son espace. Une fiche bénévole confirmée reçoit de nouveau
    son lien personnel. La mutation répond toujours vrai : un hébergeur ne peut pas
    savoir si l'adresse est connue. Une adresse reçoit au plus un rappel toutes les dix
    minutes et trois par jour (ADR 0054).
---

`lib/rappel-adresses.ts` met en file la sorte `rappel-adresse` pour un compte, et
`benevole-lien` pour une fiche confirmée. Le rappel ne part pas quand le plafond
quotidien est atteint, au lieu d'être reporté au lendemain.
