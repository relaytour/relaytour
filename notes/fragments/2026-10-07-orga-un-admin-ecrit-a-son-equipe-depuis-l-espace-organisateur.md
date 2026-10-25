---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.11.0
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
en:
  titre: >-
    An admin writes to their team from the organizer workspace
  texte: >-
    In “People”, you select people, or you write to a single person. In “Team”,
    you write to the whole team or to the coordinators of an area. You choose a
    template, complete the text, and your own mail app opens with the message.
    The application sends nothing. The “Messages” tab keeps each prepared
    message and the status you declare: in progress, sent, or canceled.
---

ADR 0020. Fenêtre `EcrireMessage` (modèles et informations de l'application dans
`lib/messages.ts`), onglet `Messages`, sélection de lignes dans le tableau des
personnes. Champ « Cci » proposé quand toute la liste est choisie, « Cc » pour une
sélection, avec un avertissement sur les adresses visibles. Un lien `mailto:` de
plus de 2 000 caractères perd son texte, puis ses adresses : la fenêtre propose
alors de les copier.
