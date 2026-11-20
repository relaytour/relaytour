---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Une séquence refusée par erreur se remet en attente
  texte: >-
    Le bouton « Remettre en attente » apparaît à côté d'une séquence refusée
    dans une candidature. La séquence repasse en attente, ou en liste
    d'attente quand ses renforts sont atteints, et aucun mail ne part. Une
    acceptation vérifie aussi l'état affiché de la séquence. Si une autre
    personne l'a traitée entre-temps, l'écran propose de recharger la
    candidature ou de l'accepter quand même.
en:
  titre: >-
    A slot declined by mistake can be set back to pending
  texte: >-
    The “Set back to pending” button appears next to a declined slot in an
    application. The slot returns to pending, or to the waiting list when its
    helpers are reached, and no email is sent. An acceptance also checks the
    state of the slot shown on screen. If another person processed it in the
    meantime, the screen offers to reload the application or to accept it
    anyway.
---

ADR 0070. Écran « Candidatures » : envoi de `statutAttendu` à
`accepterChoixCandidature`, bouton « Remettre en attente »
(`remettreChoixEnAttente`). Vue « Répartition » : envoi du statut du choix de la
candidature placée (`ChoixARepartir.candidatureId`). Un conflit ouvre la fenêtre
« Accepter quand même » ou « Recharger » (`lib/decisions-candidature.ts`).
