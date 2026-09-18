import { prisma } from '../src/client.ts'

// Données de démonstration du poste local. Rien ici ne part en recette ni en production.
async function main() {
  const email = 'demo@exemple.org'
  await prisma.newsletter.upsert({
    where: { email },
    update: {},
    create: { email },
  })
  console.log('✔ Données de démonstration posées.')
}

await main().finally(() => prisma.$disconnect())
