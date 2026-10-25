import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'
import { createTransport } from 'nodemailer'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { expedier } from '../courriel/transport.ts'

import {
  desabonnementValide,
  desabonner,
  pageDesabonnement,
} from './desabonnement.ts'
import { preferencesDe } from './notifications.ts'

// Désabonnement en un clic (ADR 0050) : la préférence coupée, l'organisation du
// jeton seule, et les en-têtes posés par le transport. Le fichier crée ses deux
// organisations et son compte.

const s = randomUUID().slice(0, 8)
const ids = { org: '', autre: '', user: '' }

beforeAll(async () => {
  ids.org = (
    await prisma.organisation.create({
      data: { slug: `desab-${s}`, nom: 'Organisation', configuration: {} },
    })
  ).id
  ids.autre = (
    await prisma.organisation.create({
      data: { slug: `desab-autre-${s}`, nom: 'Autre', configuration: {} },
    })
  ).id
  ids.user = (
    await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `personne-desab-${s}@exemple.fr`,
        name: 'Personne',
        appartenances: {
          create: [{ organisationId: ids.org }, { organisationId: ids.autre }],
        },
      },
    })
  ).id
})

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { endsWith: `-desab-${s}@exemple.fr` } },
  })
  await prisma.organisation.deleteMany({
    where: { slug: { endsWith: `-${s}` } },
  })
  await prisma.$disconnect()
})

describe('desabonner', () => {
  it('coupe un mail dans l’organisation du jeton, sans toucher aux autres réglages', async () => {
    await prisma.preferenceOrganisation.create({
      data: { userId: ids.user, organisationId: ids.org, pushTaches: false },
    })
    expect(
      await desabonner(prisma, {
        sorte: 'tache-modifiee',
        userId: ids.user,
        organisationId: ids.org,
      })
    ).toBe(true)
    const apres = await preferencesDe(prisma, ids.user, ids.org)
    expect(apres.mailModification).toBe(false)
    expect(apres.pushTaches).toBe(false)
    expect(apres.mailEcheance).toBe(true)
    // L'autre organisation garde ses propres réglages (ADR 0032).
    expect(
      (await preferencesDe(prisma, ids.user, ids.autre)).mailModification
    ).toBe(true)
  })

  it('crée la ligne de préférences quand elle manque', async () => {
    await desabonner(prisma, {
      sorte: 'resume',
      userId: ids.user,
      organisationId: ids.autre,
    })
    const apres = await preferencesDe(prisma, ids.user, ids.autre)
    expect(apres.frequenceResume).toBe('AUCUN')
    expect(apres.mailModification).toBe(true)
  })

  it('refuse un compte ou une organisation qui n’existe plus', async () => {
    // La page de confirmation fait le même contrôle : elle ne propose rien.
    expect(
      await desabonnementValide(prisma, {
        sorte: 'demandes',
        userId: ids.user,
        organisationId: ids.org,
      })
    ).toBe(true)
    const supprimee = (
      await prisma.organisation.create({
        data: {
          slug: `desab-supprimee-${s}`,
          nom: 'Supprimée',
          configuration: {},
        },
      })
    ).id
    await prisma.organisation.delete({ where: { id: supprimee } })
    expect(
      await desabonnementValide(prisma, {
        sorte: 'demandes',
        userId: ids.user,
        organisationId: supprimee,
      })
    ).toBe(false)
    expect(
      await desabonner(prisma, {
        sorte: 'demandes',
        userId: 'compte-inconnu',
        organisationId: ids.org,
      })
    ).toBe(false)
    expect(
      await desabonner(prisma, {
        sorte: 'demandes',
        userId: ids.user,
        organisationId: 'organisation-inconnue',
      })
    ).toBe(false)
  })
})

describe('en-têtes du transport', () => {
  const envoyer = async (desabonnement?: string) => {
    // Le transport en flux garde le mail brut, en-têtes compris, sans rien envoyer.
    const transport = createTransport({ streamTransport: true, buffer: true })
    const envoi = vi.spyOn(transport, 'sendMail')
    expect(
      await expedier(
        {
          destinataire: `personne-desab-${s}@exemple.fr`,
          sujet: 'Sujet',
          html: '<p>Corps</p>',
          texte: 'Corps',
          desabonnement,
        },
        transport
      )
    ).toBe('parti')
    const info = (await envoi.mock.results[0]?.value) as { message: Buffer }
    return info.message.toString()
  }

  it('pose List-Unsubscribe et List-Unsubscribe-Post sur un mail désactivable', async () => {
    const brut = await envoyer(
      'https://orga.exemple.org/medias/desabonnement/j.s'
    )
    expect(brut).toContain(
      'List-Unsubscribe: <https://orga.exemple.org/medias/desabonnement/j.s>'
    )
    expect(brut).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click')
    expect(brut).toContain('Auto-Submitted: auto-generated')
  })

  it('ne pose aucun en-tête de désabonnement sur un mail transactionnel', async () => {
    const brut = await envoyer()
    expect(brut).not.toContain('List-Unsubscribe')
    expect(brut).toContain('Auto-Submitted: auto-generated')
  })
})

describe('page de confirmation', () => {
  it('s’affiche dans la langue du compte, et suit le navigateur pour un lien non valide', async () => {
    const d = {
      sorte: 'rappels-echeance',
      userId: ids.user,
      organisationId: ids.org,
    } as const
    const francaise = await pageDesabonnement(prisma, 'confirmer', d)
    expect(francaise).toContain('<html lang="fr">')
    expect(francaise).toContain('mails « Échéances » de ')
    expect(francaise).toContain('List-Unsubscribe" value="One-Click"')

    await prisma.user.update({
      where: { id: ids.user },
      data: { langue: 'en' },
    })
    const anglaise = await pageDesabonnement(prisma, 'fait', d)
    expect(anglaise).toContain('<html lang="en">')
    expect(anglaise).toContain('“Due dates” emails from ')

    const invalide = await pageDesabonnement(prisma, 'invalide', null, [
      'en-GB',
    ])
    expect(invalide).toContain('<html lang="en">')
    expect(invalide).toContain('Invalid link')
  })
})
