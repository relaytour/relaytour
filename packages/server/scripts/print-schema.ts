import { writeSchemaFile } from '../src/lib/print-schema.ts'
import { schema } from '../src/schema/index.ts'

const changed = writeSchemaFile(
  schema,
  new URL('../schema.graphql', import.meta.url)
)
console.log(
  changed ? '✔ schema.graphql mis à jour' : '= schema.graphql inchangé'
)
