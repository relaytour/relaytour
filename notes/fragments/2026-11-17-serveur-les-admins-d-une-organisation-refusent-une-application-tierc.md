---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    Les admins d'une organisation refusent une application tierce
  texte: >-
    Un admin de l'organisation refuse une application tierce par son identifiant. Le
    refus révoque ses autorisations, prévient leurs porteuses par mail et bloque les
    nouvelles demandes. L'administration de l'installation ferme les applications d'une
    organisation par `api.applications`. Un mail rappelle la fin d'une autorisation
    trente jours avant, et un autre signale une autorisation révoquée après un rejeu.
---

ADR 0067, second étage serveur. Table ApplicationRefusee, colonnes
Organisation.applicationsAutorisees et JetonAcces.rappelFinLe. La purge de nuit
efface les demandes expirées, les jetons échus et les applications oubliées depuis
30 jours. Le démarrage révoque les autorisations des applications refusées.
