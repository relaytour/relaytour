---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Les abonnements à l'agenda choisissent leurs types d'événements
  texte: >-
    Votre abonnement personnel et l'abonnement d'une activité choisissent
    séparément les réunions de l'agenda global, les dates clés et les phases.
    Les phases sont décochées à la création, car elles occupent plusieurs
    semaines d'un agenda. Un admin de l'activité modifie ces types sans changer
    l'adresse. Les boutons de la nouvelle adresse ne débordent plus de leur
    encadré sur un téléphone.
en:
  titre: >-
    Calendar subscriptions choose their event types
  texte: >-
    Your personal subscription and an activity subscription choose global
    calendar meetings, key dates and phases separately. Phases are unchecked
    when a subscription is created, because they fill several weeks of a
    calendar. An activity admin changes these types without changing the
    address. The buttons of a new address no longer overflow their box on a
    phone.
---

ADR 0037, mise à jour du 30 octobre 2026. Trois champs remplacent
`inclureGlobal` (gardé en base, plus lu) : `inclurePhases` (faux par défaut),
`inclureDatesCles` et `inclureReunions`. La migration recopie `inclureGlobal`
dans les trois champs : les abonnements existants gardent leur contenu.
Nouvelle mutation `reglerAbonnementAgendaActivite`, réservée aux admins de
l'activité.
