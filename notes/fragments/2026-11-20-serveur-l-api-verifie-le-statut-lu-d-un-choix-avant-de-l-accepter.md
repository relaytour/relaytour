---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.35.0
fr:
  titre: >-
    L'API vérifie le statut lu d'un choix avant de l'accepter
  texte: >-
    `accepterChoixCandidature` et `placerBenevole` acceptent l'argument
    facultatif `statutAttendu`. Un choix dont le statut a changé depuis la
    lecture répond `CONFLIT_VERSION`, avec l'extension `statutCourant`, et
    aucun mail ne part. Un choix déjà accepté rend la candidature sans rien
    écrire. La mutation `remettreChoixEnAttente` remet en attente un choix
    refusé, sans mail.
en:
  titre: >-
    The API checks the status of a choice as read before accepting it
  texte: >-
    `accepterChoixCandidature` and `placerBenevole` accept the optional
    `statutAttendu` argument. A choice whose status changed since it was read
    returns `CONFLIT_VERSION`, with the `statutCourant` extension, and no
    email is sent. A choice already accepted returns the application without
    writing anything. The `remettreChoixEnAttente` mutation sets a declined
    choice back to pending, without an email.
---

ADR 0070. La garde se vérifie dans `accepterSurSequence`, sous les verrous de
la candidature et de la séquence, avant toute écriture et avant
`annoncerPlace`. Pour `placerBenevole`, un choix accepté dont la fiche tient
déjà sa place ne s'écrit pas une seconde fois ; un choix accepté dont la place
a été retirée se replace. La remise en attente prend les verrous de
l'organisation, de la candidature puis de la séquence, recalcule le statut par
`statutAuDepot` et rouvre la candidature avec l'adresse en attente du dépôt
(nulle pour une ligne importée avec un identifiant externe). Nouveau champ
`ChoixARepartir.candidatureId`.
