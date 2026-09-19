---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Votre organisation choisit le fond de son espace
  texte: >-
    Le thème de votre organisation peut maintenant décrire le fond de
    l'espace organisateur. Vous choisissez la couleur de transition du
    dégradé et la couleur et l'intensité de ses deux halos. Sans ces
    valeurs, le fond suit les couleurs de votre thème, comme avant.
---

- Bloc `fond` facultatif dans `theme` d'`organisation.yaml` : `transition`,
  `halo1` et `halo2` (`couleur`, `intensite` de 0 à 0,35).
- `fondDerive(couleurs)` donne le fond par défaut ; `fusionnerTheme` dérive
  le fond des couleurs fusionnées, puis applique les valeurs déclarées.
- Type GraphQL `FondTheme` et variables CSS `--rt-sol-transition`,
  `--rt-halo-1`, `--rt-halo-2`.
