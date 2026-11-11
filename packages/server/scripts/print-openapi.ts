import { writeFileSync, readFileSync, existsSync } from 'node:fs'

import { contratOpenApi } from '../src/api-rest/openapi.ts'
import { schema } from '../src/schema/index.ts'

// Contrat OpenAPI de l'API REST v1 (ADR 0064), commité et vérifié en CI comme
// schema.graphql. La version reste fixe dans le fichier : le serveur sert sa
// propre version, et le contrat ne change pas à chaque publication.

const cible = new URL('../openapi.json', import.meta.url)
const contenu = `${JSON.stringify(contratOpenApi(schema, '0.0.0-contrat'), null, 2)}\n`
const avant = existsSync(cible) ? readFileSync(cible, 'utf8') : ''
if (avant !== contenu) writeFileSync(cible, contenu)
console.log(
  avant === contenu ? '= openapi.json inchangé' : '✔ openapi.json mis à jour'
)
