import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import {
  lexicographicSortSchema,
  printSchema,
  type GraphQLSchema,
} from 'graphql'

/** Écrit le SDL trié s'il a changé. Renvoie true quand le fichier a été réécrit. */
export function writeSchemaFile(schema: GraphQLSchema, url: URL): boolean {
  const next = `${printSchema(lexicographicSortSchema(schema))}\n`
  const current = existsSync(url) ? readFileSync(url, 'utf8') : null
  if (current === next) return false
  writeFileSync(url, next)
  return true
}
