import { randomUUID } from 'node:crypto'

import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { mettreEnFile } from '../courriel/file.ts'
import { exigerMembre } from '../lib/appartenances.ts'
import {
  exigerAdminDeLEdition,
  exigerAdminDuPerimetre,
  exigerEcriture,
} from '../lib/droits.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { journal } from '../lib/journal.ts'
import { adresseValide, sansDoublon, texteRequis } from '../lib/saisie.ts'
import {
  exigerEditionOuverte,
  perimetresSouhaitesValides,
} from '../lib/souhaits.ts'

import { builder } from './builder.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'

// Les données personnelles d'un compte (adresse, affectations) ne sont lisibles que
// par la personne elle-même et par les admins. Un admin d'activité lit l'annuaire de
// l'organisation, dont il a besoin pour constituer son équipe (ADR 0010). Il ne lit
// les affectations que dans les activités qu'il administre.
const soiOuGestion = (
  personne: { id: string },
  _args: unknown,
  ctx: { personne: { id: string } | null }
) => (ctx.personne?.id === personne.id ? true : { gestion: true })

export const PersonneRef = builder.prismaObject('User', {
  name: 'Personne',
  fields: t => ({
    id: t.exposeID('id'),
    nom: t.exposeString('name'),
    email: t.exposeString('email', { authScopes: soiOuGestion }),
    // Rôle ADMIN dans l'organisation active (ADR 0008), pas un droit global. Il se
    // lit par la personne elle-même et par les admins de l'organisation ; un admin
    // d'activité lit null (ADR 0010).
    estAdmin: t.boolean({
      nullable: true,
      select: (_args, ctx) => ({
        appartenances: {
          where: { organisationId: ctx.organisation?.id ?? '' },
          select: { role: true },
        },
      }),
      resolve: (u, _args, ctx) =>
        ctx.personne?.id === u.id || ctx.personne?.estAdmin === true
          ? u.appartenances[0]?.role === 'ADMIN'
          : null,
    }),
    archive: t.boolean({ resolve: u => u.archivedAt !== null }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    // Les affectations de l'organisation active : toutes pour la personne elle-même
    // et pour un admin de l'organisation, celles des activités administrées sinon.
    affectations: t.prismaField({
      type: ['Affectation'],
      authScopes: soiOuGestion,
      args: { editionId: t.arg.id() },
      resolve: async (query, personne, args, ctx) => {
        const soi = ctx.personne?.id === personne.id
        return prisma.affectation.findMany({
          ...query,
          where: {
            userId: personne.id,
            perimetre: {
              organisationId: ctx.organisation?.id ?? '',
              ...(soi
                ? {}
                : {
                    activiteId: {
                      in: [...(await ctx.activitesAdministrees())],
                    },
                  }),
            },
            ...(args.editionId ? { editionId: String(args.editionId) } : {}),
          },
          orderBy: { createdAt: 'asc' },
        })
      },
    }),
    // Les activités que la personne administre (ADR 0010), parmi celles que la
    // personne qui lit administre elle-même.
    activitesAdministrees: t.idList({
      authScopes: soiOuGestion,
      resolve: async (personne, _args, ctx) => {
        const soi = ctx.personne?.id === personne.id
        const lignes = await prisma.adminActivite.findMany({
          where: {
            userId: personne.id,
            organisationId: ctx.organisation?.id ?? '',
            ...(soi
              ? {}
              : {
                  activiteId: { in: [...(await ctx.activitesAdministrees())] },
                }),
          },
          select: { activiteId: true },
        })
        return lignes.map(l => l.activiteId)
      },
    }),
  }),
})

export const AffectationRef = builder.prismaObject('Affectation', {
  fields: t => ({
    id: t.exposeID('id'),
    personne: t.relation('user', { type: PersonneRef }),
    perimetre: t.relation('perimetre', { type: PerimetreRef }),
    edition: t.relation('edition', { type: EditionRef }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
  }),
})

interface OrganisationDeLaPersonne {
  slug: string
  nom: string
  sigle: string | null
  role: 'ADMIN' | 'MEMBRE'
  statut: string
  active: boolean
}

const OrganisationDeLaPersonneRef = builder
  .objectRef<OrganisationDeLaPersonne>('OrganisationDeLaPersonne')
  .implement({
    description:
      'Une organisation dont la personne connectée est membre, avec son rôle.',
    fields: t => ({
      slug: t.exposeString('slug'),
      nom: t.exposeString('nom'),
      sigle: t.exposeString('sigle', { nullable: true }),
      estAdmin: t.boolean({ resolve: o => o.role === 'ADMIN' }),
      statut: t.exposeString('statut'),
      active: t.exposeBoolean('active', {
        description: 'Vrai pour l’organisation active de la requête.',
      }),
    }),
  })

builder.queryFields(t => ({
  // Les organisations de la personne, pour le choix de l'organisation active
  // (ADR 0008). Une organisation suspendue ou archivée n'y figure pas.
  mesOrganisations: t.field({
    type: [OrganisationDeLaPersonneRef],
    authScopes: { authentifie: true },
    resolve: async (_root, _args, ctx) => {
      const appartenances = await prisma.appartenance.findMany({
        where: {
          userId: ctx.personne!.id,
          organisation: { statut: { in: ['ACTIVE', 'LECTURE_SEULE'] } },
        },
        select: {
          role: true,
          organisation: {
            select: { slug: true, nom: true, sigle: true, statut: true },
          },
        },
        orderBy: { organisation: { nom: 'asc' } },
      })
      return appartenances.map(a => ({
        ...a.organisation,
        role: a.role,
        active: a.organisation.slug === ctx.organisation?.slug,
      }))
    },
  }),

  moi: t.prismaField({
    type: PersonneRef,
    nullable: true,
    resolve: (query, _root, _args, ctx) =>
      ctx.personne === null
        ? null
        : prisma.user.findUnique({ ...query, where: { id: ctx.personne.id } }),
  }),

  personnes: t.prismaField({
    type: [PersonneRef],
    authScopes: { gestion: true },
    args: { inclureArchives: t.arg.boolean({ defaultValue: false }) },
    resolve: (query, _root, { inclureArchives }, ctx) =>
      prisma.user.findMany({
        ...query,
        where: {
          appartenances: { some: { organisationId: ctx.organisation!.id } },
          ...(inclureArchives ? {} : { archivedAt: null }),
        },
        orderBy: { name: 'asc' },
      }),
  }),

  affectations: t.prismaField({
    type: [AffectationRef],
    authScopes: { gestion: true },
    args: { editionId: t.arg.id({ required: true }) },
    resolve: async (query, _root, { editionId }, ctx) =>
      prisma.affectation.findMany({
        ...query,
        where: { editionId: (await exigerAdminDeLEdition(ctx, editionId)).id },
        orderBy: [{ perimetre: { ordre: 'asc' } }, { createdAt: 'asc' }],
      }),
  }),
}))

/**
 * L'activité qui porte une invitation (ADR 0009) : son identité habille le mail et son
 * contact reçoit les réponses. C'est l'unique activité où la personne a un souhait,
 * une affectation ou un rôle d'admin. Sans lien, un admin d'activité invite pour
 * l'activité affichée qu'il administre. Sinon, l'invitation reste celle de
 * l'organisation.
 */
async function activiteDeLInvitation(
  ctx: AppContext,
  userId: string
): Promise<string | undefined> {
  const organisationId = ctx.organisation!.id
  const dansLOrganisation = { perimetre: { organisationId } }
  const [souhaits, affectations, admins] = await Promise.all([
    prisma.souhait.findMany({
      where: { userId, ...dansLOrganisation },
      select: { perimetre: { select: { activiteId: true } } },
    }),
    prisma.affectation.findMany({
      where: { userId, ...dansLOrganisation },
      select: { perimetre: { select: { activiteId: true } } },
    }),
    prisma.adminActivite.findMany({
      where: { userId, organisationId },
      select: { activiteId: true },
    }),
  ])
  const liees = new Set([
    ...[...souhaits, ...affectations].map(l => l.perimetre.activiteId),
    ...admins.map(a => a.activiteId),
  ])
  if (liees.size > 0) return liees.size === 1 ? [...liees][0] : undefined
  if (ctx.personne!.estAdmin) return undefined
  // Le compte existe déjà : l'absence d'activité ouverte ne bloque pas l'invitation.
  const affichee = await ctx.exigerActivite().catch(() => null)
  return affichee !== null && (await ctx.estAdminDe(affichee))
    ? affichee
    : undefined
}

builder.mutationFields(t => ({
  inviterPersonne: t.prismaField({
    type: PersonneRef,
    authScopes: { gestion: true },
    args: {
      email: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
      estAdmin: t.arg.boolean({ defaultValue: false }),
      // Édition et périmètres souhaités. Un souhait ne donne aucun accès.
      editionId: t.arg.id(),
      perimetresSouhaites: t.arg.idList(),
    },
    resolve: async (query, _root, args, ctx) => {
      // Seul un admin de l'organisation invite un autre admin de l'organisation.
      if (args.estAdmin && !ctx.personne!.estAdmin) throw accesRefuse()
      const email = adresseValide(args.email)
      const name = texteRequis(args.nom, 'Le nom')
      // Les souhaits sont validés avant toute création de compte.
      let souhaits: { perimetreId: string; editionId: string }[] = []
      if ((args.perimetresSouhaites ?? []).length > 0) {
        if (!args.editionId) {
          throw erreurSaisie('Choisissez l’édition des périmètres souhaités.')
        }
        const edition = await exigerEditionOuverte(ctx, args.editionId)
        await ctx.exigerAdminDe(edition.activiteId)
        const perimetreIds = await perimetresSouhaitesValides(
          args.perimetresSouhaites ?? [],
          edition.activiteId
        )
        souhaits = perimetreIds.map(perimetreId => ({
          perimetreId,
          editionId: edition.id,
        }))
      }
      const organisationId = ctx.organisation!.id
      const role = args.estAdmin ? 'ADMIN' : 'MEMBRE'
      // Un compte est global (ADR 0008) : une adresse déjà connue d'une autre
      // organisation reçoit une appartenance à celle-ci, sans nouveau compte.
      const existant = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          archivedAt: true,
          appartenances: { where: { organisationId }, select: { id: true } },
        },
      })
      if (existant !== null && existant.appartenances.length > 0) {
        throw erreurSaisie('Un compte existe déjà pour cette adresse.')
      }
      if (existant !== null && existant.archivedAt !== null) {
        throw erreurSaisie('Cette adresse ne peut pas être invitée.')
      }
      const personne = await sansDoublon(
        existant === null
          ? prisma.user.create({
              ...query,
              data: {
                id: randomUUID(),
                email,
                name,
                appartenances: { create: { organisationId, role } },
                ...(souhaits.length > 0
                  ? { souhaits: { create: souhaits } }
                  : {}),
              },
            })
          : prisma.user.update({
              ...query,
              where: { id: existant.id },
              data: {
                appartenances: { create: { organisationId, role } },
                ...(souhaits.length > 0
                  ? { souhaits: { create: souhaits } }
                  : {}),
              },
            }),
        'Un compte existe déjà pour cette adresse.'
      )
      journal.info(
        {
          evenement: 'personne-invitee',
          userId: personne.id,
          compteExistant: existant !== null,
          souhaits: souhaits.length,
          par: ctx.personne?.id,
        },
        'Une personne a été invitée.'
      )
      await mettreEnFile(
        'invitation',
        { userId: personne.id },
        {
          organisationId,
          activiteId: await activiteDeLInvitation(ctx, personne.id),
        }
      )
      return personne
    },
  }),

  renvoyerInvitation: t.boolean({
    authScopes: { gestion: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      await exigerMembre(ctx, String(id))
      // Un admin d'activité ne relance que son équipe : une personne affectée,
      // souhaitée ou admin dans une activité qu'il administre (ADR 0010).
      if (!ctx.personne!.estAdmin) {
        const activites = [...(await ctx.activitesAdministrees())]
        const equipe = await prisma.user.count({
          where: {
            id: String(id),
            OR: [
              {
                affectations: {
                  some: { perimetre: { activiteId: { in: activites } } },
                },
              },
              {
                souhaits: {
                  some: { perimetre: { activiteId: { in: activites } } },
                },
              },
              { adminsActivite: { some: { activiteId: { in: activites } } } },
            ],
          },
        })
        if (equipe === 0) throw accesRefuse()
      }
      const personne = await prisma.user.findUnique({
        where: { id: String(id) },
        select: { id: true, archivedAt: true },
      })
      if (personne === null || personne.archivedAt !== null) {
        throw erreurSaisie('Ce compte est introuvable ou archivé.')
      }
      await mettreEnFile(
        'invitation',
        { userId: personne.id },
        {
          organisationId: ctx.organisation!.id,
          activiteId: await activiteDeLInvitation(ctx, personne.id),
        }
      )
      return true
    },
  }),

  modifierPersonne: t.prismaField({
    type: PersonneRef,
    authScopes: { admin: true },
    args: {
      id: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      estAdmin: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const id = String(args.id)
      // Un admin ne retire pas ses propres droits : il ne pourrait plus les rétablir.
      if (id === ctx.personne?.id && !args.estAdmin) {
        throw erreurSaisie(
          'Vous ne pouvez pas retirer vos propres droits d’admin.'
        )
      }
      const membre = await exigerMembre(ctx, id)
      const nom = texteRequis(args.nom, 'Le nom')
      const actuel = await prisma.user.findUniqueOrThrow({
        where: { id },
        select: { name: true },
      })
      // Le nom appartient au compte, commun à toutes ses organisations.
      if (nom !== actuel.name && membre.autresOrganisations > 0) {
        throw erreurSaisie(
          'Ce compte appartient aussi à une autre organisation : seule la personne peut changer son nom.'
        )
      }
      return prisma.user.update({
        ...query,
        where: { id },
        data: {
          name: nom,
          appartenances: {
            update: {
              where: {
                userId_organisationId: {
                  userId: id,
                  organisationId: ctx.organisation!.id,
                },
              },
              data: { role: args.estAdmin ? 'ADMIN' : 'MEMBRE' },
            },
          },
        },
      })
    },
  }),

  archiverPersonne: t.prismaField({
    type: PersonneRef,
    authScopes: { admin: true },
    args: {
      id: t.arg.id({ required: true }),
      archive: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const id = String(args.id)
      if (id === ctx.personne?.id) {
        throw erreurSaisie('Vous ne pouvez pas archiver votre propre compte.')
      }
      // L'archivage porte sur le compte, commun à toutes ses organisations : un admin
      // n'archive pas le compte d'une personne qui appartient aussi à une autre.
      const membre = await exigerMembre(ctx, id)
      if (membre.autresOrganisations > 0) {
        throw erreurSaisie(
          'Ce compte appartient aussi à une autre organisation : il ne peut pas être archivé depuis la vôtre.'
        )
      }
      // L'archivage ferme aussitôt toutes les sessions ouvertes du compte.
      const [personne] = await prisma.$transaction([
        prisma.user.update({
          ...query,
          where: { id },
          data: { archivedAt: args.archive ? new Date() : null },
        }),
        ...(args.archive
          ? [prisma.session.deleteMany({ where: { userId: id } })]
          : []),
      ])
      journal.info(
        {
          evenement: args.archive ? 'personne-archivee' : 'personne-restauree',
          userId: id,
          par: ctx.personne?.id,
        },
        args.archive ? 'Un compte a été archivé.' : 'Un compte a été restauré.'
      )
      return personne
    },
  }),

  affecter: t.prismaField({
    type: AffectationRef,
    authScopes: { gestion: true },
    args: {
      personneId: t.arg.id({ required: true }),
      perimetreId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const userId = String(args.personneId)
      const perimetreId = String(args.perimetreId)
      const editionId = String(args.editionId)
      // Seul l'admin de l'activité du périmètre affecte : une affectation comme
      // référent·e d'un autre périmètre ne suffit pas.
      await exigerAdminDuPerimetre(ctx, perimetreId)
      await exigerMembre(ctx, userId)
      // Même contrôle qu'une écriture : périmètre et édition de la même activité de
      // l'organisation, édition non archivée.
      await exigerEcriture(ctx, perimetreId, editionId)
      return sansDoublon(
        prisma.affectation.create({
          ...query,
          data: {
            userId,
            perimetreId,
            editionId,
            creeParId: ctx.personne?.id ?? null,
          },
        }),
        'Cette personne est déjà affectée à ce périmètre pour cette édition.'
      )
    },
  }),

  retirerAffectation: t.boolean({
    authScopes: { gestion: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const affectation = await prisma.affectation.findFirst({
        where: {
          id: String(id),
          perimetre: { organisationId: ctx.organisation!.id },
        },
        select: { id: true, perimetre: { select: { activiteId: true } } },
      })
      // Une affectation hors des activités administrées vaut une affectation
      // inconnue : rien ne change, comme pour une autre organisation.
      if (
        affectation === null ||
        !(await ctx.estAdminDe(affectation.perimetre.activiteId))
      ) {
        return false
      }
      const { count } = await prisma.affectation.deleteMany({
        where: { id: affectation.id },
      })
      return count === 1
    },
  }),

  // Nomme ou retire un admin d'activité (ADR 0010). Seul un admin de l'organisation
  // le fait ; la personne reste membre de l'organisation.
  definirAdminActivite: t.boolean({
    authScopes: { admin: true },
    args: {
      personneId: t.arg.id({ required: true }),
      activiteId: t.arg.id({ required: true }),
      admin: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const userId = String(args.personneId)
      const activiteId = await ctx.exigerActivite(args.activiteId)
      await exigerMembre(ctx, userId)
      if (args.admin) {
        await prisma.adminActivite.upsert({
          where: { userId_activiteId: { userId, activiteId } },
          update: {},
          create: {
            userId,
            activiteId,
            organisationId,
            nommeParId: ctx.personne!.id,
          },
        })
      } else {
        await prisma.adminActivite.deleteMany({
          where: { userId, activiteId, organisationId },
        })
      }
      journal.info(
        {
          evenement: args.admin
            ? 'admin-activite-nomme'
            : 'admin-activite-retire',
          userId,
          activiteId,
          par: ctx.personne?.id,
        },
        args.admin
          ? 'Un admin d’activité a été nommé.'
          : 'Un admin d’activité a été retiré.'
      )
      return args.admin
    },
  }),
}))
