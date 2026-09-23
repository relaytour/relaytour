---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Vous ouvrez les modes d'emploi depuis le menu du compte
  texte: >-
    L'entrée « Modes d'emploi » apparaît sous « Préférences », dans le menu du
    compte. Elle ouvre dans un nouvel onglet la liste des modes d'emploi publiés
    sur le site de Relaytour, un par rôle.
---

- `MenuCompte.tsx` : entrée externe, adresse lue dans le champ `modesDEmploi`
  de la requête `Organisation`.
- `MODES_D_EMPLOI_URL` remplace l'adresse par défaut
  (`https://relaytour.org/modes-d-emploi/`).
