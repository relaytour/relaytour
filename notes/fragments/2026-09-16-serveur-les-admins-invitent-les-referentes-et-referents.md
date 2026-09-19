---
cible: serveur
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Les admins invitent les référentes et référents
  texte: >-
    Les admins créent les comptes, les éditions, les périmètres et les
    affectations. Chaque personne invitée reçoit un mail, puis se connecte
    avec un code reçu par mail, sans mot de passe. Un compte archivé perd
    aussitôt l'accès.
---

Phase 1 du plan de l'espace organisateur.

- Better Auth (emailOTP) : code haché, 10 minutes, 5 essais, 5 envois par
  adresse sur 15 minutes, 4 routes ouvertes, inscription fermée.
- Schéma : Edition, Perimetre, Affectation ; Personne (User) ; scopes
  `connecte` et `admin`.
- Mails `invitation` et `code-connexion` ; commande `admin:creer`.
- 15 tests d'intégration sur les refus d'accès.
