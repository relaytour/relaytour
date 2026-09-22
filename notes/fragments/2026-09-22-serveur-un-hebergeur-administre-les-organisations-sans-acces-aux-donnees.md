---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
fr:
  titre: >-
    Un hébergeur administre les organisations sans accès à leurs données
  texte: >-
    Un script et une API à jeton créent une organisation et sa première
    activité, invitent son premier admin, changent son statut ou ses limites
    et écrivent son export complet sur le serveur. Le jeton ne donne accès à
    aucune donnée d'une organisation, et l'export ne transite jamais par
    l'API.
---

- Scripts `organisation:creer` et `organisation:exporter` ; options
  `--organisation` de `admin:creer`, `--organisation` et `--activite` de
  `edition:creer`.
- Variable `JETON_ADMINISTRATION` (32 caractères au moins), comparée en temps
  constant ; scope `administration`. Requête `organisations`, mutations
  `creerOrganisation`, `inviterPremierAdmin`, `modifierOrganisationInstallation`,
  `demanderExport`.
- Variable `EXPORTS_DIR`, volume `exports` dans la pile de référence. Export
  JSON versionné (`relaytour-export`, version 1).
