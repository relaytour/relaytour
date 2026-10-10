import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { prisma } from '@relaytour/database'

import { connection, courrielQueue } from '../src/jobs/queues.ts'
import {
  ErreurEquipe,
  importerEquipe,
  lireEquipe,
} from '../src/lib/equipe-import.ts'
import { organisationEtActivite } from '../src/lib/installation.ts'

// Importe l'équipe d'une activité pour une période (ADR 0013) : comptes, affectations,
// contacts principaux et souhaits, décrits dans un fichier YAML.
//   yarn workspace @relaytour/server equipe:importer --fichier equipe.yaml --edition 2027
//     [--activite slug] [--organisation slug] [--simulation] [--envoyer-mails]
// Dans le conteneur : node dist/equipe-importer.js --fichier /equipe/equipe.yaml --edition 2027
// L'import crée ce qui manque et ne retire rien. Sans --envoyer-mails, aucun mail ne
// part. Le fichier contient des données personnelles : il ne va dans aucun dépôt.

const { values } = parseArgs({
  options: {
    fichier: { type: 'string' },
    edition: { type: 'string' },
    activite: { type: 'string' },
    organisation: { type: 'string' },
    simulation: { type: 'boolean', default: false },
    'envoyer-mails': { type: 'boolean', default: false },
  },
})

const annee = Number(values.edition)
if (values.fichier === undefined || !Number.isInteger(annee)) {
  console.error(
    'Usage : equipe-importer --fichier <equipe.yaml> --edition <année> [--activite slug] [--organisation slug] [--simulation] [--envoyer-mails]'
  )
  process.exit(1)
}

function afficher(titre: string, liste: string[]) {
  if (liste.length === 0) return
  console.log(`  ${titre} (${liste.length})`)
  for (const ligne of liste) console.log(`    ${ligne}`)
}

try {
  const personnes = lireEquipe(readFileSync(values.fichier, 'utf8'))
  const { organisationId, activiteId } = await organisationEtActivite(
    values.organisation,
    values.activite
  )
  const rapport = await importerEquipe(prisma, personnes, {
    organisationId,
    activiteId,
    annee,
    simulation: values.simulation,
    envoyerMails: values['envoyer-mails'],
  })
  console.log(
    values.simulation
      ? '— Simulation : rien n’a été écrit —'
      : '✔ Équipe importée'
  )
  afficher('Comptes créés', rapport.comptesCrees)
  afficher(
    'Invitations en attente (compte connu hors de l’organisation)',
    rapport.invitationsEnAttente
  )
  afficher('Comptes déjà membres', rapport.comptesExistants)
  afficher('Noms différents, laissés tels quels', rapport.nomsDifferents)
  afficher('Affectations créées', rapport.affectationsCreees)
  afficher('Affectations déjà présentes', rapport.affectationsExistantes)
  afficher('Contacts principaux', rapport.contactsPrincipaux)
  afficher('Souhaits créés', rapport.souhaitsCrees)
  afficher('Souhaits déjà présents', rapport.souhaitsExistants)
  afficher('Souhaits ignorés', rapport.souhaitsIgnores)
  if (!values.simulation) {
    console.log(
      values['envoyer-mails']
        ? `  Mails mis en file : ${rapport.mails.invitations} invitation(s), ${rapport.mails.equipe} mail(s) d’équipe`
        : '  Aucun mail envoyé (option --envoyer-mails absente).'
    )
  }
} catch (erreur) {
  if (erreur instanceof ErreurEquipe) {
    console.error(erreur.message)
    process.exitCode = 1
  } else {
    throw erreur
  }
} finally {
  await courrielQueue.close()
  connection.disconnect()
  await prisma.$disconnect()
}
