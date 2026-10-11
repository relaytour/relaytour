import type {
  OrigineInvitation,
  Prisma,
  PrismaClient,
  RoleOrganisation,
} from '@relaytour/database'
import { z } from 'zod'

import { creerAffectations } from './affectations.ts'
import { accesRefuse, erreurSaisie } from './erreurs.ts'
import { publierNotification, publierPourActivite } from './flux.ts'
import { journal } from './journal.ts'
import { SOUHAITS_MAX } from './souhaits.ts'

// Invitation d'un compte qui existe déjà hors de l'organisation (ADR 0030).
//
// Les organisations d'une installation sont cloisonnées. Une adresse connue d'une
// autre organisation ne reçoit ni appartenance, ni affectation, ni souhait : une
// invitation attend que la personne l'accepte. L'organisation ne lit de cette
// invitation que ce qu'elle a saisi. Une invitation expirée n'existe plus pour
// personne : chaque lecture et chaque mutation passe par `vivante()`.

/** Durée de vie d'une invitation, en jours. */
export const INVITATION_JOURS = 30

const Identifiants = z.array(z.string().min(1)).max(200)

const LotSchema = z.object({
  editionId: z.string().min(1),
  activiteId: z.string().min(1),
  affectes: Identifiants,
  souhaites: Identifiants,
  contactPrincipal: Identifiants,
})

/** Ce que l'acceptation créera pour une période : des identifiants de périmètres. */
export type LotInvitation = z.infer<typeof LotSchema>

/** Les lots d'une invitation, ou une liste vide si la colonne est illisible. */
export function lireLots(valeur: unknown): LotInvitation[] {
  const lu = z.array(LotSchema).safeParse(valeur)
  return lu.success ? lu.data : []
}

const reunion = (a: string[], b: string[]) => [...new Set([...a, ...b])]

/**
 * Ajoute un lot à ceux d'une invitation. Deux invitations pour la même période se
 * réunissent : un périmètre affecté l'emporte sur le même périmètre souhaité.
 */
export function fusionnerLots(
  existants: LotInvitation[],
  nouveau: LotInvitation
): LotInvitation[] {
  const autres = existants.filter(l => l.editionId !== nouveau.editionId)
  const meme = existants.find(l => l.editionId === nouveau.editionId)
  const affectes = reunion(meme?.affectes ?? [], nouveau.affectes)
  return [
    ...autres,
    {
      editionId: nouveau.editionId,
      activiteId: nouveau.activiteId,
      affectes,
      souhaites: reunion(meme?.souhaites ?? [], nouveau.souhaites).filter(
        id => !affectes.includes(id)
      ),
      contactPrincipal: reunion(
        meme?.contactPrincipal ?? [],
        nouveau.contactPrincipal
      ).filter(id => affectes.includes(id)),
    },
  ]
}

/** Le filtre Prisma d'une invitation qui n'a pas expiré. */
export function vivante(maintenant = new Date()) {
  return { expireLe: { gt: maintenant } }
}

function expiration(instant: Date): Date {
  return new Date(instant.getTime() + INVITATION_JOURS * 24 * 3600 * 1000)
}

/**
 * Enregistre l'invitation d'un compte extérieur à l'organisation, ou complète celle
 * qui attend déjà : ses périmètres se réunissent, le rôle d'admin l'emporte, et le
 * délai repart. `tx` est la transaction de l'appelant.
 */
export async function inviterCompteExterne(
  tx: Prisma.TransactionClient,
  invitation: {
    organisationId: string
    userId: string
    role: RoleOrganisation
    nom: string
    origine: OrigineInvitation
    inviteParId: string | null
    lot?: LotInvitation
    instant: Date
  }
): Promise<{ id: string }> {
  const { organisationId, userId, instant, lot } = invitation
  // Le verrou sur le compte sérialise deux invitations simultanées de la même adresse.
  await tx.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`
  const cle = { organisationId_userId: { organisationId, userId } }
  const enCours = await tx.invitationOrganisation.findUnique({
    where: cle,
    select: { role: true, globale: true, lots: true, expireLe: true },
  })
  // Une invitation expirée ne compte plus : la nouvelle la remplace entièrement.
  const reprise =
    enCours !== null && enCours.expireLe > instant ? enCours : null
  const lots =
    lot === undefined
      ? lireLots(reprise?.lots)
      : fusionnerLots(lireLots(reprise?.lots), lot)
  for (const l of lots) {
    if (l.souhaites.length > SOUHAITS_MAX) {
      throw erreurSaisie(
        `Une personne a ${SOUHAITS_MAX} souhaits au plus pour une période.`
      )
    }
  }
  const donnees = {
    role:
      reprise?.role === 'ADMIN' || invitation.role === 'ADMIN'
        ? ('ADMIN' as const)
        : ('MEMBRE' as const),
    nom: invitation.nom,
    origine: invitation.origine,
    inviteParId: invitation.inviteParId,
    globale: (reprise?.globale ?? false) || lot === undefined,
    lots,
    expireLe: expiration(instant),
  }
  return tx.invitationOrganisation.upsert({
    where: cle,
    create: { organisationId, userId, ...donnees },
    update: donnees,
    select: { id: true },
  })
}

/** Les admins de l'organisation, pour une notification. */
async function adminsDeLOrganisation(
  tx: Prisma.TransactionClient,
  organisationId: string
): Promise<string[]> {
  const admins = await tx.appartenance.findMany({
    where: { organisationId, role: 'ADMIN', user: { archivedAt: null } },
    select: { userId: true },
  })
  return admins.map(a => a.userId)
}

/**
 * La personne accepte son invitation : l'appartenance naît, puis les affectations
 * et les souhaits de chaque lot encore valide (période non archivée, périmètre non
 * archivé). La marque de contact principal ne s'applique qu'à un périmètre qui n'en
 * a pas (ADR 0011). L'invitation d'une autre personne, expirée ou inconnue reçoit le
 * même refus.
 */
export async function accepterInvitation(
  prisma: PrismaClient,
  demande: { invitationId: string; userId: string },
  instant = new Date()
): Promise<{ organisationSlug: string }> {
  const { invitationId, userId } = demande
  const issue = await prisma.$transaction(async tx => {
    // Les verrous se prennent avant toute lecture ordinaire : l'instantané de la
    // transaction naît à la première, et doit voir ce que les transactions
    // précédentes ont validé. La première lecture, verrouillante, rend les lots ;
    // les périmètres dont l'invitation propose le contact principal se
    // verrouillent ensuite dans un ordre fixe. Deux personnes invitées comme
    // contact principal du même périmètre qui acceptent ensemble se suivent, et
    // la seconde lit la désignation de la première (ADR 0011).
    const verrouillees = await tx.$queryRaw<{ lots: unknown }[]>`
      SELECT lots FROM InvitationOrganisation
      WHERE id = ${invitationId} AND userId = ${userId} FOR UPDATE`
    const brut = verrouillees[0]?.lots
    const aVerrouiller = new Set(
      lireLots(typeof brut === 'string' ? JSON.parse(brut) : brut).flatMap(
        l => l.contactPrincipal
      )
    )
    for (const perimetreId of [...aVerrouiller].sort()) {
      await tx.$queryRaw`SELECT id FROM Perimetre WHERE id = ${perimetreId} FOR UPDATE`
    }
    const invitation = await tx.invitationOrganisation.findFirst({
      where: { id: invitationId, userId, ...vivante(instant) },
      select: {
        id: true,
        organisationId: true,
        role: true,
        origine: true,
        inviteParId: true,
        lots: true,
        organisation: { select: { slug: true, statut: true } },
      },
    })
    if (invitation === null) throw accesRefuse()
    const { organisationId } = invitation
    if (invitation.organisation.statut !== 'ACTIVE') {
      throw erreurSaisie(
        'Cette organisation n’accueille pas de nouvelle personne pour le moment.'
      )
    }
    await tx.appartenance.upsert({
      where: { userId_organisationId: { userId, organisationId } },
      create: { userId, organisationId, role: invitation.role },
      // Le rôle d'admin de l'invitation s'ajoute ; il ne retire jamais un rôle.
      update: invitation.role === 'ADMIN' ? { role: 'ADMIN' } : {},
    })

    const activites: { activiteId: string; editionId: string }[] = []
    for (const lot of lireLots(invitation.lots)) {
      const edition = await tx.edition.findFirst({
        where: {
          id: lot.editionId,
          organisationId,
          activiteId: lot.activiteId,
          statut: { not: 'ARCHIVEE' },
        },
        select: { id: true },
      })
      if (edition === null) continue
      const valides = new Set(
        (
          await tx.perimetre.findMany({
            where: {
              id: { in: [...lot.affectes, ...lot.souhaites] },
              organisationId,
              activiteId: lot.activiteId,
              archivedAt: null,
            },
            select: { id: true },
          })
        ).map(p => p.id)
      )
      const affectes = lot.affectes.filter(id => valides.has(id))
      await creerAffectations(tx, {
        userId,
        perimetreIds: affectes,
        editionId: edition.id,
        creeParId: invitation.inviteParId,
        instant,
      })
      for (const perimetreId of lot.contactPrincipal) {
        if (!affectes.includes(perimetreId)) continue
        // La désignation faite pendant l'attente l'emporte. Le périmètre est
        // verrouillé depuis le début de la transaction.
        const titulaire = await tx.affectation.count({
          where: { perimetreId, editionId: edition.id, contactPrincipal: true },
        })
        if (titulaire > 0) continue
        await tx.affectation.update({
          where: {
            userId_perimetreId_editionId: {
              userId,
              perimetreId,
              editionId: edition.id,
            },
          },
          data: { contactPrincipal: true },
        })
      }
      const dejaSouhaites = new Set(
        (
          await tx.souhait.findMany({
            where: { userId, editionId: edition.id },
            select: { perimetreId: true },
          })
        ).map(s => s.perimetreId)
      )
      const places = Math.max(SOUHAITS_MAX - dejaSouhaites.size, 0)
      const souhaits = lot.souhaites
        .filter(
          id =>
            valides.has(id) && !affectes.includes(id) && !dejaSouhaites.has(id)
        )
        .slice(0, places)
      if (souhaits.length > 0) {
        await tx.souhait.createMany({
          data: souhaits.map(perimetreId => ({
            userId,
            perimetreId,
            editionId: edition.id,
          })),
          skipDuplicates: true,
        })
      }
      activites.push({ activiteId: lot.activiteId, editionId: edition.id })
    }

    await tx.invitationOrganisation.delete({ where: { id: invitation.id } })

    // Qui apprend l'acceptation : la personne qui a invité, les admins de
    // l'organisation pour un import, personne pour un premier admin.
    const aPrevenir =
      invitation.origine === 'PERSONNE'
        ? invitation.inviteParId === null
          ? []
          : (
              await tx.appartenance.findMany({
                where: {
                  organisationId,
                  userId: invitation.inviteParId,
                  user: { archivedAt: null },
                },
                select: { userId: true },
              })
            ).map(a => a.userId)
        : invitation.origine === 'IMPORT'
          ? await adminsDeLOrganisation(tx, organisationId)
          : []
    const destinataires = aPrevenir.filter(id => id !== userId)
    if (destinataires.length > 0) {
      await tx.notification.createMany({
        data: destinataires.map(destinataire => ({
          organisationId,
          userId: destinataire,
          type: 'INVITATION_ACCEPTEE' as const,
          acteurId: userId,
          activiteId: activites[0]?.activiteId ?? null,
        })),
      })
    }
    return {
      organisationId,
      organisationSlug: invitation.organisation.slug,
      activites,
      destinataires,
      origine: invitation.origine,
    }
  })

  for (const destinataire of issue.destinataires) {
    publierNotification(issue.organisationId, destinataire)
  }
  for (const { activiteId, editionId } of issue.activites) {
    publierPourActivite('EQUIPE', issue.organisationId, activiteId, {
      editionId,
    })
  }
  journal.info(
    {
      evenement: 'invitation-acceptee',
      userId,
      organisationId: issue.organisationId,
      origine: issue.origine,
    },
    'Une invitation a été acceptée.'
  )
  return { organisationSlug: issue.organisationSlug }
}

/**
 * La personne refuse son invitation : la ligne disparaît, et l'organisation n'en
 * apprend rien. Une invitation d'une autre personne ou inconnue ne change rien.
 */
export async function refuserInvitation(
  prisma: PrismaClient,
  demande: { invitationId: string; userId: string }
): Promise<boolean> {
  const { count } = await prisma.invitationOrganisation.deleteMany({
    where: { id: demande.invitationId, userId: demande.userId },
  })
  if (count > 0) {
    journal.info(
      { evenement: 'invitation-refusee', userId: demande.userId },
      'Une invitation a été refusée.'
    )
  }
  return count > 0
}

/** Efface les invitations expirées, que plus rien ne lit. */
export async function purgerInvitations(
  prisma: PrismaClient | Prisma.TransactionClient,
  maintenant = new Date()
): Promise<number> {
  const { count } = await prisma.invitationOrganisation.deleteMany({
    where: { expireLe: { lte: maintenant } },
  })
  return count
}

/**
 * Où en est une personne avec une organisation, pour le mail d'invitation : membre,
 * invitée (avec les périmètres proposés, « Football (Rencontres 2027) »), ou rien.
 */
export async function invitationEnAttente(
  prisma: PrismaClient,
  userId: string,
  organisationId: string,
  maintenant = new Date()
): Promise<
  'membre' | 'aucune' | { perimetres: string[]; role: RoleOrganisation }
> {
  const appartenance = await prisma.appartenance.count({
    where: { userId, organisationId },
  })
  if (appartenance > 0) return 'membre'
  const invitation = await prisma.invitationOrganisation.findFirst({
    where: { userId, organisationId, ...vivante(maintenant) },
    select: { lots: true, role: true },
  })
  if (invitation === null) return 'aucune'
  return {
    role: invitation.role,
    perimetres: await perimetresProposes(
      prisma,
      organisationId,
      lireLots(invitation.lots)
    ),
  }
}

/** « Football (Rencontres 2027) » pour chaque périmètre encore proposé par les lots. */
export async function perimetresProposes(
  prisma: PrismaClient,
  organisationId: string,
  lots: LotInvitation[]
): Promise<string[]> {
  const lignes: string[] = []
  for (const lot of lots) {
    const edition = await prisma.edition.findFirst({
      where: { id: lot.editionId, organisationId, statut: { not: 'ARCHIVEE' } },
      select: { nom: true },
    })
    if (edition === null) continue
    const perimetres = await prisma.perimetre.findMany({
      where: {
        id: { in: [...lot.affectes, ...lot.souhaites] },
        organisationId,
        archivedAt: null,
      },
      select: { nom: true },
      orderBy: { ordre: 'asc' },
    })
    lignes.push(...perimetres.map(p => `${p.nom} (${edition.nom})`))
  }
  return lignes
}

/**
 * La clé de la limite d'un mail d'invitation : par organisation et par personne.
 * Une organisation ne consomme pas la limite d'une autre, et n'apprend pas par un
 * refus qu'une autre vient d'écrire à la même personne (ADR 0030).
 */
export function cleRelance(organisationId: string, userId: string): string {
  return `relance-invitation:${organisationId}:${userId}`
}

/**
 * Met en file le mail d'une invitation en attente, une fois par personne et par
 * heure au plus dans une organisation : la même limite que la relance. Une organisation qui répète
 * l'invitation d'une adresse extérieure n'inonde pas sa boîte. Renvoie faux quand
 * le mail n'est pas parti.
 */
export async function annoncerInvitation(
  userId: string,
  porteur: { organisationId: string; activiteId?: string | undefined }
): Promise<boolean> {
  const [{ limiterParCle }, { mettreEnFile }] = await Promise.all([
    import('./limite.ts'),
    import('../courriel/file.ts'),
  ])
  if (
    !(await limiterParCle(cleRelance(porteur.organisationId, userId), 1, 3600))
  ) {
    return false
  }
  await mettreEnFile('invitation', { userId }, porteur)
  return true
}
