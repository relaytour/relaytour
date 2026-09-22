---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
version: 0.4.0
fr:
  titre: >-
    L'espace organisateur suit l'organisation et l'activité choisies
  texte: >-
    Les pages d'une activité vivent sous son identifiant, par exemple
    /rencontres/retroplanning. Un sélecteur change d'activité, et le menu du
    compte change d'organisation pour une personne qui en a plusieurs. Les
    périmètres se rangent dans les groupes de l'activité, et la période prend
    le nom d'édition, de saison ou de mandat. Les admins gèrent les activités
    dans une nouvelle page.
---

- Garde de session : connexion, choix de l'organisation, choix mémorisé
  oublié quand il n'est plus valide.
- Fournisseur d'activité : en-tête `X-Relaytour-Activite`, cache vidé au
  changement d'activité, redirection des anciennes adresses.
- Page « Activités » : création, groupes de périmètres, nature, archivage,
  message de limite atteinte.
- Bandeau pour une organisation en lecture seule et pour une activité
  archivée.
- Premiers tests unitaires de l'espace organisateur (Vitest).
