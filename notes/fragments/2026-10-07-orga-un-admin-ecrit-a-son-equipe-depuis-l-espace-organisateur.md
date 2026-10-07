---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Un admin écrit à son équipe depuis l'espace organisateur
  texte: >-
    Dans « Personnes », vous cochez des personnes, ou vous écrivez à une seule
    personne. Dans « Équipe », vous écrivez à toute l'équipe ou aux référentes
    et aux référents d'un périmètre. Vous choisissez un modèle, vous complétez
    le texte, puis votre propre messagerie s'ouvre avec le message :
    l'application n'envoie rien. L'onglet « Messages » garde chaque message
    préparé et l'état que vous déclarez : en cours, envoyé ou annulé.
---

ADR 0020. Fenêtre `EcrireMessage` (modèles et informations de l'application dans
`lib/messages.ts`), onglet `Messages`, sélection de lignes dans le tableau des
personnes. Champ « Cci » proposé quand toute la liste est choisie, « Cc » pour une
sélection, avec un avertissement sur les adresses visibles. Un lien `mailto:` de
plus de 2 000 caractères perd son texte, puis ses adresses : la fenêtre propose
alors de les copier.
