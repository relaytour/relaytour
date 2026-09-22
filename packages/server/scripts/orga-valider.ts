import path from 'node:path'

import { ErreurModeles, lireModeles } from '../src/orga/modeles.ts'

// Valide un dossier de contenu sans base de données (content/exemple par défaut). Lancé par la CI à chaque PR.
const racine = path.resolve(
  process.argv[2] ??
    process.env.CONTENU_ORGA ??
    path.join(import.meta.dirname, '../../../content/exemple')
)

try {
  const { organisation, disposition, activites } = lireModeles(racine)
  console.log(
    `✔ ${racine} valide : ${organisation.sigle ?? organisation.nom}, disposition ${disposition === 'plate' ? 'plate' : 'activites/'}, ${activites.length} activité(s).`
  )
  for (const activite of activites) {
    const nombreTaches = [...activite.taches.values()].reduce(
      (n, liste) => n + liste.length,
      0
    )
    const nom = activite.implicite
      ? organisation.slug
      : activite.declaration.slug
    console.log(
      `  ${nom} (${activite.declaration.nature.toLowerCase()}) : ${activite.perimetres.length} périmètre(s), ${activite.fiches.length} fiche(s), ${nombreTaches} tâche(s) type.`
    )
  }
} catch (erreur) {
  console.error(erreur instanceof ErreurModeles ? erreur.message : erreur)
  process.exit(1)
}
