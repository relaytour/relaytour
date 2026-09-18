import { sonderDependances } from '../lib/sante.ts'

import { builder } from './builder.ts'

builder.queryField('health', t =>
  t.string({
    resolve: async () => {
      const { db, redis } = await sonderDependances()
      return `db:${db} redis:${redis}`
    },
  })
)
