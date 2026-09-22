import './health.ts'
import './organisation.ts'
import './activites.ts'
import './installation.ts'
import './personnes.ts'
import './taches.ts'
import './fiches.ts'
import './recherche.ts'
import './notifications.ts'
import './score.ts'
import './postes.ts'
import './souhaits.ts'

import { builder } from './builder.ts'

export const schema = builder.toSchema()
