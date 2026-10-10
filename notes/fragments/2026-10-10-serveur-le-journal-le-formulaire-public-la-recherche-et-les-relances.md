---
cible: serveur
type: securite
audience: interne
etat: prevu
fr:
  titre: >-
    Le journal, le formulaire public, la recherche et les relances se resserrent
  texte: >-
    Les messages d'erreur SMTP, de push et de job entrent dans le journal avec
    leurs adresses tronquées. Le formulaire public n'accepte plus que vingt dépôts
    par adresse IP et par jour. La recherche ne remonte plus les personnes
    affectées seulement dans une période archivée. Une invitation ne se relance
    qu'une fois par heure et par personne. Un mail parti n'est plus renvoyé quand
    la suite de l'envoi échoue. Le filtre des SVG lit aussi les entités encodées.
---

`sansAdresses` (`lib/journal.ts`) sur `transport.ts`, `worker.ts` et
`push.processor.ts`. `DEPOTS_PAR_IP_ET_PAR_JOUR` dans `schema/formulaire.ts`.
`edition.statut != ARCHIVEE` dans `schema/recherche.ts`, avec un cas de test.
`limiterParCle('relance-invitation:<id>', 1, 3600)` dans `renvoyerInvitation`.
`apresEnvoi` sous `try` dans `courriel.processor.ts`. `decoderEntites` dans
`lib/medias.ts`, qui applique la liste noire au texte décodé (`javascript&#58;`,
`onload&#61;`). `SECURITY.md` dit quelles versions reçoivent les correctifs et dans
quels délais ; `infra/README.md` gagne une section « Sauvegarder et restaurer ».
