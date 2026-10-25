---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.11.0
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
en:
  titre: >-
    An admin appoints a person from their account window
  texte: >-
    The account window on the People screen now offers appointed areas as well
    as areas of interest, for each activity you administer. A text explains the
    difference: an appointment makes the person a coordinator of the area, while
    an interest only records their wish. The Sheet editing screen lists admins
    separately, without offering them as a choice, because their role already
    gives them sheet editing.
---

`Personnes.tsx` : `ChampsPerimetres` remplace `ChampSouhaits`. Les mutations
`Affecter` et `RetirerAffectation` passent dans `lib/requetes.ts`, partagées avec
l'écran Équipe. Les nouvelles affectations partent avant les souhaits, les
retraits après (ADR 0018).
