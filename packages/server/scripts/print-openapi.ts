import { writeFileSync, readFileSync, existsSync } from 'node:fs'

import { contratOpenApi, VERSION_CONTRAT_API } from '../src/api-rest/openapi.ts'
import { schema } from '../src/schema/index.ts'

// Contrat OpenAPI de l'API REST v1 (ADR 0064), commité et vérifié en CI comme
// schema.graphql. La version est celle du contrat, la même que le serveur sert : le
// fichier ne change pas à chaque publication, et un visiteur sans jeton n'apprend pas
// la version de l'installation.

const cible = new URL('../openapi.json', import.meta.url)
const contenu = `${JSON.stringify(contratOpenApi(schema, VERSION_CONTRAT_API), null, 2)}\n`
const avant = existsSync(cible) ? readFileSync(cible, 'utf8') : ''
if (avant !== contenu) writeFileSync(cible, contenu)
console.log(
  avant === contenu ? '= openapi.json inchangé' : '✔ openapi.json mis à jour'
)
