---
cible: serveur
type: fonctionnalite
audience: organisateurs
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Les admins notent les souhaits des personnes invitées
  texte: >-
    Un souhait indique qu'une personne s'intéresse à un périmètre pour une
    édition. Les admins sont les seules personnes à le voir, et il ne donne
    aucun accès. L'affectation de la personne à ce périmètre satisfait le
    souhait.
---

- Table `Souhait` (migration additive `souhaits`), en cascade sur la personne,
  le périmètre et l'édition. Aucun texte libre.
- `Souhait.satisfait` se calcule à la lecture : une affectation du même triplet
  existe. Les affectations d'une édition sont lues une fois par requête.
- `PostesPerimetre.souhaits` : souhaits non satisfaits de comptes non archivés.
- `Personne.souhaits(editionId)` réservé aux admins, y compris pour `moi`.
- Mutations admin `definirSouhaits` (remplace l'ensemble, journal
  `souhaits-definis`) et `retirerSouhait` (journal `souhait-retire`, refusé sur
  une édition archivée).
- `inviterPersonne` accepte `editionId` et `perimetresSouhaites`, validés avant
  la création du compte. Règles dans `src/lib/souhaits.ts`.
