---
cible: serveur
type: securite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.10.0
fr:
  titre: >-
    Un admin d'activité ne lit plus que l'équipe de ses activités
  texte: >-
    Un admin d'activité lisait l'annuaire de toute l'organisation, noms et
    adresses, et pouvait affecter n'importe quel membre. Il lit désormais
    l'équipe de ses activités seulement : les personnes affectées, intéressées
    ou admins. Il n'affecte, ne note un souhait et n'accorde un droit de
    rédaction que pour ces personnes. L'annuaire complet reste lisible par les
    admins de l'organisation. L'adresse d'une personne ne se lit plus depuis
    une activité où vous êtes simple référente ou référent, même si vous
    administrez une autre activité.
---

ADR 0018. `personnes` passe au scope `admin`. Le champ `Personne.email` s'ouvre à la
personne, à l'admin de l'organisation et aux admins d'une activité dont elle fait
partie de l'équipe (`equipeAdministree`, mémo du contexte). `exigerMembreGere`
remplace `exigerMembre` dans `affecter`, `definirSouhaits`, `accorderDroitRedaction`
et `renvoyerInvitation` : une personne hors de l'équipe reçoit le refus d'un
identifiant inconnu. `Demande.dejaMembre` ne compare, pour un admin d'activité,
qu'aux adresses de ses équipes.
