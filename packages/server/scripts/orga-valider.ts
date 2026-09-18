import path from 'node:path'

import { ErreurModeles, lireModeles } from '../src/orga/modeles.ts'

// Valide un dossier de contenu sans base de données (content/exemple par défaut). Lancé par la CI à chaque PR.
const racine = path.resolve(
  process.argv[2] ??
    process.env.CONTENU_ORGA ??
    path.join(import.meta.dirname, '../../../content/exemple')
)

try {
  const { perimetres, fiches, taches } = lireModeles(racine)
  const nombreTaches = [...taches.values()].reduce(
    (n, liste) => n + liste.length,
    0
  )
  console.log(
    `✔ ${racine} valide : ${perimetres.length} périmètre(s), ${fiches.length} fiche(s), ${nombreTaches} tâche(s) type.`
  )
} catch (erreur) {
  console.error(erreur instanceof ErreurModeles ? erreur.message : erreur)
  process.exit(1)
}
