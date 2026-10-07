---
cible: serveur
type: fonctionnalite
audience: interne
etat: prevu
fr:
  titre: >-
    Le serveur garde l'historique des messages des admins
  texte: >-
    Le serveur enregistre les messages que les admins préparent pour leur
    équipe, avec leurs destinataires et le statut déclaré par l'auteur. Il
    n'envoie aucun de ces messages.
---

ADR 0020. Migration additive `20261007090000_messages` (tables `Message` et
`MessageDestinataire`). Requête `messages(activiteId)`, mutations `creerMessage` et
`definirStatutMessage`, entité `MESSAGE` du flux des changements, messages ajoutés à
l'export complet d'une organisation. Chaque destinataire est vérifié : un compte
inconnu, archivé, d'une autre organisation ou hors de l'équipe donne le même refus.
