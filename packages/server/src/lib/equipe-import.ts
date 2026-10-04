import type { PrismaClient } from '@relaytour/database'
import { parse } from 'yaml'
import { z } from 'zod'

import { mettreEnFile } from '../courriel/file.ts'

import { creerAffectations } from './affectations.ts'
import { creerOuRattacherCompte } from './comptes.ts'
import { annoncerChangementEquipe } from './equipe.ts'
import { adresseValide } from './saisie.ts'

// Import d'une équipe depuis le serveur (ADR 0013) : les comptes, les affectations,
// les contacts principaux et les souhaits d'une activité pour une période, décrits
// dans un fichier YAML. La commande s'exécute dans le conteneur, sans route réseau.
//
// L'import est additif et rejouable : il crée ce qui manque et ne retire rien. Le
// fichier se valide en entier avant toute écriture, puis tout s'écrit dans une seule
// transaction. Aucun mail ne part sans l'option d'envoi. Le fichier contient des
// données personnelles : il ne va dans aucun dépôt Git (invariant 2).

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug attendu')

const PersonneDeclaree = z.strictObject({
  nom: z.string().trim().min(1).max(120),
  adresse: z.string().trim().min(3).max(254),
  affectations: z.array(Slug).default([]),
  contactPrincipal: z.array(Slug).default([]),
  souhaits: z.array(Slug).default([]),
})

const FichierEquipe = z.strictObject({
  personnes: z.array(PersonneDeclaree).min(1).max(500),
})

export type PersonneEquipe = z.output<typeof PersonneDeclaree>

export class ErreurEquipe extends Error {
  constructor(readonly erreurs: string[]) {
    super(`Fichier d'équipe invalide :\n- ${erreurs.join('\n- ')}`)
  }
}

/** Lit et valide le texte d'un fichier d'équipe, sans rien vérifier en base. */
export function lireEquipe(texte: string): PersonneEquipe[] {
  const resultat = FichierEquipe.safeParse(parse(texte))
  if (!resultat.success) {
    throw new ErreurEquipe(
      resultat.error.issues.map(i => `${i.path.join('.')} : ${i.message}`)
    )
  }
  const erreurs: string[] = []
  const adresses = new Map<string, number>()
  const contacts = new Map<string, string>()
  resultat.data.personnes.forEach((p, i) => {
    let adresse = ''
    try {
      adresse = adresseValide(p.adresse)
    } catch {
      erreurs.push(`personnes.${i} : adresse invalide (${p.adresse})`)
    }
    if (adresse !== '') {
      if (adresses.has(adresse)) {
        erreurs.push(`personnes.${i} : adresse déjà listée (${adresse})`)
      }
      adresses.set(adresse, i)
    }
    // Un slug répété créerait deux fois la même affectation ou le même souhait.
    for (const liste of [
      'affectations',
      'contactPrincipal',
      'souhaits',
    ] as const) {
      const repetes = p[liste].filter((slug, j) => p[liste].indexOf(slug) !== j)
      if (repetes.length > 0) {
        erreurs.push(
          `personnes.${i}.${liste} : périmètre répété (${[...new Set(repetes)].join(', ')})`
        )
      }
    }
    for (const slug of p.contactPrincipal) {
      if (!p.affectations.includes(slug)) {
        erreurs.push(
          `personnes.${i} : contact principal de ${slug} sans y être affecté·e`
        )
      }
      const deja = contacts.get(slug)
      if (deja !== undefined) {
        erreurs.push(
          `personnes.${i} : ${slug} a déjà un contact principal (${deja})`
        )
      }
      contacts.set(slug, p.nom)
    }
  })
  if (erreurs.length > 0) throw new ErreurEquipe(erreurs)
  return resultat.data.personnes.map(p => ({
    ...p,
    adresse: adresseValide(p.adresse),
  }))
}

export interface RapportEquipe {
  comptesCrees: string[]
  comptesRattaches: string[]
  comptesExistants: string[]
  nomsDifferents: string[]
  affectationsCreees: string[]
  affectationsExistantes: string[]
  contactsPrincipaux: string[]
  souhaitsCrees: string[]
  souhaitsExistants: string[]
  souhaitsIgnores: string[]
  mails: { invitations: number; equipe: number }
}

export async function importerEquipe(
  prisma: PrismaClient,
  personnes: PersonneEquipe[],
  options: {
    organisationId: string
    activiteId: string
    annee: number
    simulation?: boolean
    envoyerMails?: boolean
  }
): Promise<RapportEquipe> {
  const { organisationId, activiteId } = options
  const edition = await prisma.edition.findFirst({
    where: { activiteId, annee: options.annee },
    select: { id: true, statut: true, nom: true },
  })
  if (edition === null) {
    throw new ErreurEquipe([
      `l'activité n'a aucune période ${options.annee} : créez-la d'abord (edition:creer)`,
    ])
  }
  if (edition.statut === 'ARCHIVEE') {
    throw new ErreurEquipe([`la période ${edition.nom} est archivée`])
  }
  const perimetres = new Map(
    (
      await prisma.perimetre.findMany({
        where: { activiteId, archivedAt: null },
        select: { id: true, slug: true },
      })
    ).map(p => [p.slug, p.id])
  )
  const inconnus = new Set<string>()
  for (const p of personnes) {
    for (const slug of [...p.affectations, ...p.souhaits]) {
      if (!perimetres.has(slug)) inconnus.add(slug)
    }
  }
  if (inconnus.size > 0) {
    throw new ErreurEquipe([
      `périmètres inconnus ou archivés dans cette activité : ${[...inconnus].sort().join(', ')}`,
    ])
  }

  const rapport: RapportEquipe = {
    comptesCrees: [],
    comptesRattaches: [],
    comptesExistants: [],
    nomsDifferents: [],
    affectationsCreees: [],
    affectationsExistantes: [],
    contactsPrincipaux: [],
    souhaitsCrees: [],
    souhaitsExistants: [],
    souhaitsIgnores: [],
    mails: { invitations: 0, equipe: 0 },
  }
  const ecrire = options.simulation !== true
  // Le même instant date les affectations et choisit la fenêtre des mails d'équipe.
  const instant = new Date()
  const aInviter: string[] = []
  const aAnnoncer = new Set<string>()

  await prisma.$transaction(
    async tx => {
      for (const p of personnes) {
        const compte = await creerOuRattacherCompte(tx, {
          email: p.adresse,
          nom: p.nom,
          organisationId,
          role: 'MEMBRE',
          simulation: !ecrire,
        })
        if (compte.issue === 'archive') {
          throw new ErreurEquipe([`${p.adresse} : compte archivé`])
        }
        const { userId } = compte
        const nouveau = compte.issue === 'cree'
        if (nouveau) {
          rapport.comptesCrees.push(p.nom)
          aInviter.push(userId)
        } else if (compte.issue === 'rattache') {
          rapport.comptesRattaches.push(p.nom)
          aInviter.push(userId)
        } else {
          rapport.comptesExistants.push(p.nom)
        }
        // Le nom appartient au compte : l'import ne le change pas.
        if (compte.nomDuCompte !== null && compte.nomDuCompte !== p.nom) {
          rapport.nomsDifferents.push(
            `${p.nom} (compte : ${compte.nomDuCompte})`
          )
        }

        const { creees } = await creerAffectations(tx, {
          userId,
          perimetreIds: p.affectations.map(slug => perimetres.get(slug)!),
          editionId: edition.id,
          creeParId: null,
          instant,
          simulation: !ecrire,
        })
        const affectationsCreees = new Set(creees)
        for (const slug of p.affectations) {
          const perimetreId = perimetres.get(slug)!
          const cle = { userId, perimetreId, editionId: edition.id }
          if (affectationsCreees.has(perimetreId)) {
            rapport.affectationsCreees.push(`${p.nom} → ${slug}`)
            // Une personne déjà membre apprend sa nouvelle place par le mail d'équipe.
            if (compte.issue === 'membre') aAnnoncer.add(userId)
          } else {
            rapport.affectationsExistantes.push(`${p.nom} → ${slug}`)
          }
          if (p.contactPrincipal.includes(slug)) {
            rapport.contactsPrincipaux.push(`${slug} : ${p.nom}`)
            if (ecrire) {
              // Un seul contact principal par périmètre et par période (ADR 0011).
              await tx.affectation.updateMany({
                where: { perimetreId, editionId: edition.id, NOT: { userId } },
                data: { contactPrincipal: false },
              })
              await tx.affectation.update({
                where: { userId_perimetreId_editionId: cle },
                data: { contactPrincipal: true },
              })
            }
          }
        }

        for (const slug of p.souhaits) {
          if (p.affectations.includes(slug)) {
            rapport.souhaitsIgnores.push(`${p.nom} → ${slug} (affecté·e)`)
            continue
          }
          const perimetreId = perimetres.get(slug)!
          const cle = { userId, perimetreId, editionId: edition.id }
          const souhait = nouveau
            ? null
            : await tx.souhait.findUnique({
                where: { userId_perimetreId_editionId: cle },
                select: { id: true },
              })
          if (souhait === null) {
            rapport.souhaitsCrees.push(`${p.nom} → ${slug}`)
            if (ecrire) await tx.souhait.create({ data: cle })
          } else {
            rapport.souhaitsExistants.push(`${p.nom} → ${slug}`)
          }
        }
      }
    },
    { timeout: 60_000 }
  )

  if (ecrire && options.envoyerMails === true) {
    // Une personne invitée reçoit l'invitation, qui liste déjà ses périmètres. Une
    // personne déjà membre reçoit le mail d'équipe regroupé (ADR 0012).
    for (const userId of aInviter) {
      await mettreEnFile(
        'invitation',
        { userId },
        { organisationId, activiteId }
      )
    }
    for (const userId of aAnnoncer) {
      await annoncerChangementEquipe(userId, {
        organisationId,
        activiteId,
        instant,
      })
    }
    rapport.mails = { invitations: aInviter.length, equipe: aAnnoncer.size }
  }
  return rapport
}
