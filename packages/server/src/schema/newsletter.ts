import { prisma } from '@relaytour/database'

import { builder } from './builder.ts'

// Inscription publique à la newsletter. La liste des adresses n'est exposée par aucune
// query ; les admins ne voient que le nombre d'abonnés.
const ADRESSE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

builder.mutationField('subscribeNewsletter', t =>
  t.boolean({
    args: {
      email: t.arg.string({ required: true }),
    },
    resolve: async (_root, { email }) => {
      const adresse = email.trim().toLowerCase()
      if (!ADRESSE.test(adresse) || adresse.length > 191) return false
      // Même réponse que l'adresse soit nouvelle ou déjà inscrite : la mutation ne révèle
      // pas qui est abonné.
      await prisma.newsletter.upsert({
        where: { email: adresse },
        update: {},
        create: { email: adresse },
      })
      return true
    },
  })
)

builder.queryField('nombreAbonnesNewsletter', t =>
  t.int({
    authScopes: { admin: true },
    resolve: () => prisma.newsletter.count(),
  })
)
