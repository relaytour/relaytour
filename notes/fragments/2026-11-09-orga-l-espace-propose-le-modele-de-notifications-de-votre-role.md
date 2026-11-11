---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    L'espace propose le modèle de notifications de votre rôle
  texte: >-
    Quand votre rôle change, vos réglages de notifications restent les mêmes. Un
    avis discret vous propose alors le modèle de votre nouveau rôle, au plus une
    fois par jour. Vous l'appliquez en un clic, ou vous refusez la proposition. La
    notification et le mail qui annoncent votre nouvelle place mènent aussi à vos
    préférences. Une personne nommée contact principal en est prévenue dans
    l'application.
en:
  titre: >-
    The space suggests the notification preset for your role
  texte: >-
    When your role changes, your notification settings stay the same. A discreet
    notice then suggests the preset for your new role, at most once a day. You
    apply it in one click, or you decline the suggestion. The notification and the
    email announcing your new place also lead to your preferences. A person named
    main contact is told in the app.
---

ADR 0065, lot 4. `propositionModele` et `ecarterPropositionModele` dans le contrat,
`PreferenceOrganisation.modeleEcarte`, composant `PropositionModele` monté dans la
coquille. `definirContactPrincipal` appelle `notifierPlace`.
