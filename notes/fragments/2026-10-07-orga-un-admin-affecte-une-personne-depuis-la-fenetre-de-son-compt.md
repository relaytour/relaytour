---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Un admin affecte une personne depuis la fenêtre de son compte
  texte: >-
    La fenêtre d'un compte, sur l'écran Personnes, propose désormais les
    périmètres affectés en plus des périmètres souhaités, pour chaque activité
    que vous administrez. Un texte rappelle la différence : une affectation
    rend la personne référent·e du périmètre, un souhait note seulement un
    intérêt. L'écran Rédaction liste les admins à part, sans les proposer au
    choix : leur rôle leur donne déjà la rédaction des fiches.
---

`Personnes.tsx` : `ChampsPerimetres` remplace `ChampSouhaits`. Les mutations
`Affecter` et `RetirerAffectation` passent dans `lib/requetes.ts`, partagées avec
l'écran Équipe. Les nouvelles affectations partent avant les souhaits, les
retraits après (ADR 0018).
