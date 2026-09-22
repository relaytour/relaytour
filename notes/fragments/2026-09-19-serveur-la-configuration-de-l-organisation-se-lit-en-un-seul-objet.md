---
cible: serveur
type: interne
audience: interne
etat: prevu
version: 0.4.0
fr:
  titre: >-
    La configuration de l'organisation se lit en un seul objet
  texte: >-
    Le nom, le sigle, les domaines de mail, le contact, la page équipe et le
    thème de l'organisation forment une configuration unique, validée par un
    schéma strict. Les sujets de mail, l'expéditeur, l'appel aux référentes et
    référents et la détection des données personnelles la lisent. Les
    variables d'environnement restent un amorçage avant le premier import.
---

- `src/lib/organisation.ts` : `DeclarationOrganisationSchema` (refus d'un thème
  sous 4,5:1 de contraste, d'une police hors liste, d'un contact hors des
  domaines), `resoudreConfiguration`, `configurationOrganisation()` (cache 60 s).
- Le serveur dépend de `@relaytour/tokens` (thème par défaut, contraste).
- `donneesPersonnelles` exige désormais la liste des domaines.
