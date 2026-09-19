import { prisma } from '../src/client.ts'

// Données de démonstration du poste local. Rien ici ne part sur une installation déployée.
// Le contenu d'une organisation s'importe avec orga:importer, pas par ce script.
function main() {
  console.log(
    'Aucune donnée de démonstration : importez content/exemple avec orga:importer.'
  )
}

try {
  main()
} finally {
  await prisma.$disconnect()
}
