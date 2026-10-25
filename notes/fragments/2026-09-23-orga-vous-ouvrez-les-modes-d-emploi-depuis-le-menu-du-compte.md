---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.6.0
fr:
  titre: >-
    Vous ouvrez les modes d'emploi depuis le menu du compte
  texte: >-
    L'entrée « Modes d'emploi » apparaît sous « Préférences », dans le menu du
    compte. Elle ouvre dans un nouvel onglet la liste des modes d'emploi publiés
    sur le site de Relaytour, un par rôle.
en:
  titre: >-
    You open the user guides from the account menu
  texte: >-
    The “User guides” entry appears under “Preferences” in the account menu. It
    opens, in a new tab, the list of user guides published on the Relaytour
    site, one per role.
---

- `MenuCompte.tsx` : entrée externe, adresse lue dans le champ `modesDEmploi`
  de la requête `Organisation`.
- `MODES_D_EMPLOI_URL` remplace l'adresse par défaut
  (`https://relaytour.org/modes-d-emploi/`).
