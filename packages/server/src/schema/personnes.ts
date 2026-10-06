import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { mettreEnFile } from '../courriel/file.ts'
import { creerAffectations } from '../lib/affectations.ts'
import {
  dansLEquipe,
  exigerMembre,
  exigerMembreGere,
} from '../lib/appartenances.ts'
import { creerOuRattacherCompte } from '../lib/comptes.ts'
import { annoncerChangementEquipe } from '../lib/equipe.ts'
import {
  exigerAdminDeLEdition,
  exigerAdminDuPerimetre,
  exigerEcriture,
} from '../lib/droits.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { journal } from '../lib/journal.ts'
import {
  adresseValide,
  rejouerSurDoublon,
  sansDoublon,
  texteRequis,
} from '../lib/saisie.ts'
import {
  exigerEditionOuverte,
  perimetresSouhaitesValides,
} from '../lib/souhaits.ts'

import { publierPourActivite, publierPourPerimetre } from '../lib/flux.ts'

import { builder } from './builder.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'

// Les affectations et les rôles d'un compte ne sont lisibles que par la personne
// elle-même et par les admins. Un admin d'activité ne les lit que dans les activités
// qu'il administre : chaque résolveur filtre (ADR 0010).
const soiOuGestion = (
  personne: { id: string },
  _args: unknown,
  ctx: { personne: { id: string } | null }
) => (ctx.personne?.id === personne.id ? true : { gestion: true })

interface AttributionActivite {
  activiteId: string
  affectee: boolean
  interessee: boolean
  admin: boolean
}

const AttributionActiviteRef = builder
  .objectRef<AttributionActivite>('AttributionActivite')
  .implement({
    description:
      'Le lien d’une personne avec une activité de l’organisation, toutes périodes confondues (ADR 0018).',
    fields: t => ({
      activiteId: t.exposeID('activiteId'),
      affectee: t.exposeBoolean('affectee', {
        description: 'Vrai quand la personne y a au moins une affectation.',
      }),
      interessee: t.exposeBoolean('interessee', {
        description: 'Vrai quand la personne y a au moins un souhait.',
      }),
      admin: t.exposeBoolean('admin', {
        description: 'Vrai quand la personne administre l’activité.',
      }),
    }),
  })

// Les attributions de tous les membres d'une organisation, lues une fois par requête :
// l'annuaire les demande pour chaque personne.
const attributionsParRequete = new WeakMap<
  AppContext,
  Promise<Map<string, AttributionActivite[]>>
>()

function attributionsDeLOrganisation(
  ctx: AppContext
): Promise<Map<string, AttributionActivite[]>> {
  let attributions = attributionsParRequete.get(ctx)
  if (attributions === undefined) {
    const organisationId = ctx.organisation?.id ?? ''
    const parPerimetre = {
      where: { perimetre: { organisationId } },
      select: { userId: true, perimetre: { select: { activiteId: true } } },
    }
    attributions = Promise.all([
      prisma.affectation.findMany(parPerimetre),
      prisma.souhait.findMany(parPerimetre),
      prisma.adminActivite.findMany({
        where: { organisationId },
        select: { userId: true, activiteId: true },
      }),
    ]).then(([affectations, souhaits, admins]) => {
      const parPersonne = new Map<string, Map<string, AttributionActivite>>()
      const noter = (
        userId: string,
        activiteId: string,
        lien: 'affectee' | 'interessee' | 'admin'
      ) => {
        const activites =
          parPersonne.get(userId) ?? new Map<string, AttributionActivite>()
        parPersonne.set(userId, activites)
        const attribution = activites.get(activiteId) ?? {
          activiteId,
          affectee: false,
          interessee: false,
          admin: false,
        }
        attribution[lien] = true
        activites.set(activiteId, attribution)
      }
      for (const a of affectations)
        noter(a.userId, a.perimetre.activiteId, 'affectee')
      for (const s of souhaits)
        noter(s.userId, s.perimetre.activiteId, 'interessee')
      for (const a of admins) noter(a.userId, a.activiteId, 'admin')
      return new Map(
        [...parPersonne].map(([userId, activites]) => [
          userId,
          [...activites.values()],
        ])
      )
    })
    attributionsParRequete.set(ctx, attributions)
  }
  return attributions
}

export const PersonneRef = builder.prismaObject('User', {
  name: 'Personne',
  fields: t => ({
    id: t.exposeID('id'),
    nom: t.exposeString('name'),
    // L'adresse se lit par la personne elle-même, par un admin de l'organisation et
    // par un admin d'une activité dont elle fait partie de l'équipe (ADR 0018). Le
    // rôle d'admin d'une autre activité ne l'ouvre pas.
    email: t.exposeString('email', {
      authScopes: async (personne, _args, ctx) =>
        ctx.personne?.id === personne.id ||
        ctx.personne?.estAdmin === true ||
        (await ctx.equipeAdministree()).has(personne.id),
    }),
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
    // Les activités où la personne participe, pour l'annuaire de l'admin de
    // l'organisation : il y lit qui est où avant d'affecter ou d'inviter (ADR 0018).
    attributions: t.field({
      type: [AttributionActiviteRef],
      authScopes: { admin: true },
      // Le champ lit un mémo de la requête, pas la base, et rend au plus une ligne
      // par activité : ses champs ne comptent pas comme ceux d'une liste ouverte.
      complexity: { field: 1, multiplier: 1 },
      resolve: async (personne, _args, ctx) =>
        (await attributionsDeLOrganisation(ctx)).get(personne.id) ?? [],
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
    contactPrincipal: t.exposeBoolean('contactPrincipal', {
      description:
        'Vrai pour le contact principal du périmètre et de l’édition : une information, sans droit supplémentaire (ADR 0011).',
    }),
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

  // L'annuaire de l'organisation, réservé à ses admins (ADR 0018). Un admin
  // d'activité lit son équipe par la requête `equipe`.
  personnes: t.prismaField({
    type: [PersonneRef],
    authScopes: { admin: true },
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

  // L'équipe d'une activité (ADR 0018) : les membres qui y ont une affectation, un
  // souhait ou un rôle d'admin, toutes périodes confondues. Seuls ses admins la
  // lisent. Sans identifiant, la requête porte sur l'activité affichée.
  equipe: t.prismaField({
    type: [PersonneRef],
    authScopes: { gestion: true },
    args: { activiteId: t.arg.id() },
    resolve: async (query, _root, args, ctx) => {
      const activiteId = await ctx.exigerActivite(args.activiteId)
      await ctx.exigerAdminDe(activiteId)
      return prisma.user.findMany({
        ...query,
        where: {
          archivedAt: null,
          appartenances: { some: { organisationId: ctx.organisation!.id } },
          ...dansLEquipe([activiteId]),
        },
        orderBy: { name: 'asc' },
      })
    },
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
 * une affectation ou un rôle d'admin. Sinon, l'invitation reste celle de
 * l'organisation.
 */
async function activiteDeLInvitation(
  organisationId: string,
  userId: string
): Promise<string | undefined> {
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
  return liees.size === 1 ? [...liees][0] : undefined
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
      let cible: { activiteId: string; editionId: string } | null = null
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
        cible = { activiteId: edition.activiteId, editionId: edition.id }
      }
      // Un admin d'activité fait entrer une personne dans son équipe par un périmètre
      // (ADR 0018). Le refus précède toute lecture de compte : il ne dit rien de
      // l'adresse.
      if (souhaits.length === 0 && !ctx.personne!.estAdmin) {
        throw erreurSaisie(
          'Choisissez au moins un périmètre : la personne rejoint votre équipe par ce périmètre.'
        )
      }
      const organisationId = ctx.organisation!.id
      const role = args.estAdmin ? 'ADMIN' : 'MEMBRE'
      const dejaLa = 'Un compte existe déjà pour cette adresse.'
      // Le compte, son appartenance et ses souhaits s'écrivent ensemble. Une adresse
      // déjà connue d'une autre organisation garde son compte (ADR 0008). Deux
      // invitations simultanées de la même adresse se suivent : la seconde relit le
      // compte créé par la première.
      const compte = await rejouerSurDoublon(() =>
        prisma.$transaction(async tx => {
          const compte = await creerOuRattacherCompte(tx, {
            email,
            nom: name,
            organisationId,
            role,
          })
          // Seul l'admin de l'organisation, qui lit l'annuaire, apprend qu'un compte
          // archivé de son organisation porte l'adresse.
          if (compte.issue === 'archive') {
            throw erreurSaisie(
              compte.dejaMembre && ctx.personne!.estAdmin
                ? dejaLa
                : 'Cette adresse ne peut pas être invitée.'
            )
          }
          // Un compte déjà membre rejoint l'équipe par ses souhaits, sans que la
          // réponse le distingue d'un compte créé (ADR 0018). Sans souhait, ou pour
          // un rôle d'admin, la personne qui invite est admin de l'organisation.
          if (
            compte.issue === 'membre' &&
            (souhaits.length === 0 || args.estAdmin)
          ) {
            throw erreurSaisie(dejaLa)
          }
          if (souhaits.length > 0) {
            await tx.souhait.createMany({
              data: souhaits.map(s => ({ ...s, userId: compte.userId })),
              skipDuplicates: true,
            })
          }
          return compte
        })
      )
      const personne = await prisma.user.findUniqueOrThrow({
        ...query,
        where: { id: compte.userId },
      })
      journal.info(
        {
          evenement: 'personne-invitee',
          userId: personne.id,
          compte: compte.issue,
          souhaits: souhaits.length,
          par: ctx.personne?.id,
        },
        'Une personne a été invitée.'
      )
      // Une personne déjà membre a déjà reçu son invitation. Un souhait ne lui
      // envoie aucun mail (ADR 0012).
      if (compte.issue !== 'membre') {
        await mettreEnFile(
          'invitation',
          { userId: personne.id },
          {
            organisationId,
            activiteId: await activiteDeLInvitation(
              organisationId,
              personne.id
            ),
          }
        )
      }
      if (cible !== null) {
        publierPourActivite('EQUIPE', organisationId, cible.activiteId, {
          editionId: cible.editionId,
        })
      }
      return personne
    },
  }),

  renvoyerInvitation: t.boolean({
    authScopes: { gestion: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      // Un admin d'activité ne relance que son équipe (ADR 0018).
      await exigerMembreGere(ctx, String(id))
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
          activiteId: await activiteDeLInvitation(
            ctx.organisation!.id,
            personne.id
          ),
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
      const organisationId = ctx.organisation!.id
      const [actuel, appartenance] = await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id },
          select: { name: true },
        }),
        prisma.appartenance.findUniqueOrThrow({
          where: { userId_organisationId: { userId: id, organisationId } },
          select: { role: true },
        }),
      ])
      // Le nom appartient au compte, commun à toutes ses organisations.
      if (nom !== actuel.name && membre.autresOrganisations > 0) {
        throw erreurSaisie(
          'Ce compte appartient aussi à une autre organisation : seule la personne peut changer son nom.'
        )
      }
      // Le rôle ne s'écrit que s'il change : la date de mise à jour de
      // l'appartenance date alors une vraie nomination (mails d'équipe, ADR 0012).
      const role = args.estAdmin ? 'ADMIN' : 'MEMBRE'
      const instant = new Date()
      const personne = await prisma.user.update({
        ...query,
        where: { id },
        data: {
          name: nom,
          ...(role === appartenance.role
            ? {}
            : {
                appartenances: {
                  update: {
                    where: {
                      userId_organisationId: { userId: id, organisationId },
                    },
                    data: { role, updatedAt: instant },
                  },
                },
              }),
        },
      })
      if (role === 'ADMIN' && appartenance.role !== 'ADMIN') {
        await annoncerChangementEquipe(id, { organisationId, instant })
      }
      return personne
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
      const { activiteId } = await exigerAdminDuPerimetre(ctx, perimetreId)
      // Un admin d'activité n'affecte qu'une personne de ses équipes (ADR 0018). Il
      // y fait entrer une autre personne par une invitation.
      await exigerMembreGere(ctx, userId)
      // Même contrôle qu'une écriture : périmètre et édition de la même activité de
      // l'organisation, édition non archivée.
      await exigerEcriture(ctx, perimetreId, editionId)
      // Le même instant date l'affectation et choisit la fenêtre du mail d'équipe.
      const instant = new Date()
      const dejaAffectee =
        'Cette personne est déjà affectée à ce périmètre pour cette édition.'
      const { creees } = await sansDoublon(
        creerAffectations(prisma, {
          userId,
          perimetreIds: [perimetreId],
          editionId,
          creeParId: ctx.personne?.id ?? null,
          instant,
        }),
        dejaAffectee
      )
      if (creees.length === 0) throw erreurSaisie(dejaAffectee)
      const affectation = await prisma.affectation.findUniqueOrThrow({
        ...query,
        where: {
          userId_perimetreId_editionId: { userId, perimetreId, editionId },
        },
      })
      // La personne apprend sa nouvelle place par un mail regroupé (ADR 0012).
      await annoncerChangementEquipe(userId, {
        organisationId: ctx.organisation!.id,
        activiteId,
        instant,
      })
      publierPourPerimetre('EQUIPE', perimetreId, { editionId })
      return affectation
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
        select: {
          id: true,
          perimetreId: true,
          editionId: true,
          perimetre: { select: { activiteId: true } },
        },
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
      if (count === 1) {
        publierPourPerimetre('EQUIPE', affectation.perimetreId, {
          editionId: affectation.editionId,
        })
      }
      return count === 1
    },
  }),

  // Désigne ou retire le contact principal d'un périmètre pour une édition
  // (ADR 0011). Le contact principal ne reçoit aucun droit : seule l'information
  // change. Un périmètre n'en a qu'un par édition : désigner une personne retire la
  // désignation précédente.
  definirContactPrincipal: t.boolean({
    authScopes: { gestion: true },
    args: {
      affectationId: t.arg.id({ required: true }),
      contactPrincipal: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const affectation = await prisma.affectation.findFirst({
        where: {
          id: String(args.affectationId),
          perimetre: { organisationId: ctx.organisation!.id },
        },
        select: {
          id: true,
          perimetreId: true,
          editionId: true,
          perimetre: { select: { activiteId: true } },
        },
      })
      // Comme pour retirerAffectation : hors des activités administrées, rien ne
      // change et la réponse ne dit pas si l'affectation existe.
      if (
        affectation === null ||
        !(await ctx.estAdminDe(affectation.perimetre.activiteId))
      ) {
        return false
      }
      // Une édition archivée reste en lecture seule.
      await exigerEcriture(ctx, affectation.perimetreId, affectation.editionId)
      await prisma.$transaction([
        ...(args.contactPrincipal
          ? [
              prisma.affectation.updateMany({
                where: {
                  perimetreId: affectation.perimetreId,
                  editionId: affectation.editionId,
                  contactPrincipal: true,
                  NOT: { id: affectation.id },
                },
                data: { contactPrincipal: false },
              }),
            ]
          : []),
        prisma.affectation.update({
          where: { id: affectation.id },
          data: { contactPrincipal: args.contactPrincipal },
        }),
      ])
      publierPourPerimetre('EQUIPE', affectation.perimetreId, {
        editionId: affectation.editionId,
      })
      return true
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
        const instant = new Date()
        await prisma.adminActivite.upsert({
          where: { userId_activiteId: { userId, activiteId } },
          update: {},
          create: {
            userId,
            activiteId,
            organisationId,
            nommeParId: ctx.personne!.id,
            createdAt: instant,
          },
        })
        // Une nomination déjà faite ne crée pas de ligne : le mail ne dira rien.
        await annoncerChangementEquipe(userId, {
          organisationId,
          activiteId,
          instant,
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
