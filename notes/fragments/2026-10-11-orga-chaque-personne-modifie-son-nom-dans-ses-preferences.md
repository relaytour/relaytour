---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.17.0
fr:
  titre: >-
    Chaque personne modifie son nom dans ses préférences
  texte: >-
    Le panneau « Votre compte » des préférences porte le bouton « Modifier mon
    nom ». Ce nom s'affiche dans toutes vos organisations. Un admin de
    l'organisation corrige encore le nom d'une personne tant qu'elle ne s'est
    jamais connectée. L'annuaire parle de « personnes archivées » : archiver une
    personne ferme son accès à votre organisation, et elle garde son compte.
en:
  titre: >-
    Everyone can edit their own name in their preferences
  texte: >-
    The “Your account” panel in the preferences has an “Edit my name” button.
    This name appears in all your organizations. An organization admin can still
    correct a person’s name until they have signed in for the first time. The
    directory refers to “archived people”: archiving a person closes their
    access to your organization, and they keep their account.
---

ADR 0031. `Preferences.tsx` appelle `modifierMonNom`. `Personnes.tsx` lit
`Personne.nomModifiable` et désactive le champ « Prénom et nom » quand il vaut
faux. Le texte de confirmation de l'archivage ne parle plus de déconnexion.
