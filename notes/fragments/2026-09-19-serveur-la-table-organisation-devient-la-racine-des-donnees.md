---
cible: serveur
type: interne
audience: interne
etat: prevu
fr:
  titre: >-
    La table Organisation devient la racine des données
  texte: >-
    Une ligne Organisation porte le slug, le nom, le sigle, le fuseau horaire
    et la déclaration complète de l'organisation. Les éditions, périmètres,
    fiches, notifications et préférences reçoivent sa clé. L'import crée ou
    met à jour cette ligne depuis organisation.yaml ; l'API, les mails et
    l'espace organisateur lisent désormais la configuration en base.
---

- Migration additive `organisation` : table, clés nulles, index et clés
  étrangères. `assurerOrganisationParDefaut()` crée la ligne d'amorçage depuis
  l'environnement au démarrage et rattache les données sans clé.
- `organisationParDefaut()` sur chaque écriture (lot commun) ; le lot multi le
  remplacera par l'organisation du contexte.
- L'import refuse le contenu d'une autre organisation que celle de
  l'installation (le slug d'amorçage « defaut » se renomme).
