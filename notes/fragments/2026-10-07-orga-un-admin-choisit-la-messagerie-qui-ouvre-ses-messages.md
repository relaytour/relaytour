---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.12.0
fr:
  titre: >-
    Un admin choisit la messagerie qui ouvre ses messages
  texte: >-
    Dans « Préférences », le panneau « Votre messagerie » fixe la messagerie
    qui s'ouvre quand vous préparez un message : celle de votre appareil, une
    messagerie en ligne (Gmail, Outlook, Yahoo Mail, Proton Mail) ou
    l'application Gmail ou Outlook. Le bouton « Essayer » ouvre un message
    d'essai adressé à vous seul·e. Votre navigateur garde ce choix, et la
    fenêtre « Écrire un message » permet de le changer pour un message. Le mode
    d'emploi « Choisir votre messagerie » décrit chaque choix et le réglage de
    chaque système.
---

ADR 0022. Cibles et liens de composition dans `lib/messagerie.ts`, sélecteur
`ChoixMessagerie`, panneau `PreferenceMessagerie`. Le choix se garde dans
`localStorage` (`relaytour.messagerie`), sans champ serveur. Une application
ouverte par son schéma d'URL ne s'enregistre qu'après un essai confirmé. Les
cibles dont les champs « Cc » et « Cci » ne sont pas confirmés affichent un
avertissement dans la fenêtre de rédaction.
