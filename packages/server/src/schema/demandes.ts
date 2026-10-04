import {
  OrigineDemande,
  prisma,
  StatutDemande,
  type Prisma,
} from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { mettreEnFile } from '../courriel/file.ts'
import { creerAffectations } from '../lib/affectations.ts'
import { creerOuRattacherCompte } from '../lib/comptes.ts'
import {
  motValide,
  PROPOSITIONS_EN_ATTENTE_MAX,
  signalerDemande,
} from '../lib/demandes.ts'
import { exigerAdminDeLEdition, exigerEcriture } from '../lib/droits.ts'
import { annoncerChangementEquipe } from '../lib/equipe.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { journal } from '../lib/journal.ts'
import { adresseValide, rejouerSurDoublon, texteRequis } from '../lib/saisie.ts'
import { perimetresSouhaitesValides, SOUHAITS_MAX } from '../lib/souhaits.ts'

import { builder } from './builder.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'
import { PersonneRef } from './personnes.ts'

// Demandes pour rejoindre l'équipe (ADR 0015). Les admins d'une activité lisent et
// traitent ses demandes. Un·e référent·e propose une personne pour son périmètre et
// ne lit que ses propres propositions, sans adresse.

const StatutDemandeEnum = builder.enumType(StatutDemande, {
  name: 'StatutDemande',
})
const OrigineDemandeEnum = builder.enumType(OrigineDemande, {
  name: 'OrigineDemande',
})

// ── Types ────────────────────────────────────────────────────────────────────

const DemandePerimetreRef = builder.prismaObject('DemandePerimetre', {
  fields: t => ({
    id: t.exposeID('id'),
    perimetre: t.relation('perimetre', { type: PerimetreRef }),
    proposePar: t.relation('proposePar', { type: PersonneRef, nullable: true }),
    mot: t.exposeString('mot', { nullable: true }),
  }),
})

// Ce type n'est rendu que par les opérations réservées aux admins de l'activité.
const DemandeRef = builder.prismaObject('Demande', {
  fields: t => ({
    id: t.exposeID('id'),
    nom: t.exposeString('nom'),
    adresse: t.exposeString('adresse'),
    origine: t.expose('origine', { type: OrigineDemandeEnum }),
    statut: t.expose('statut', { type: StatutDemandeEnum }),
    creeLe: t.expose('createdAt', { type: 'DateTime' }),
    traiteeLe: t.expose('traiteeLe', { type: 'DateTime', nullable: true }),
    traiteePar: t.relation('traiteePar', { type: PersonneRef, nullable: true }),
    edition: t.relation('edition', { type: EditionRef }),
    perimetres: t.relation('perimetres', {
      type: DemandePerimetreRef,
      query: { orderBy: { createdAt: 'asc' } },
    }),
    dejaMembre: t.boolean({
      description:
        'Vrai quand un compte de l’organisation porte déjà cette adresse : accepter la demande ne crée alors aucun compte.',
      resolve: async demande =>
        (await prisma.appartenance.count({
          where: {
            organisationId: demande.organisationId,
            user: { email: demande.adresse },
          },
        })) > 0,
    }),
  }),
})

// Une proposition, vue par la personne qui l'a faite : ni adresse, ni autre périmètre.
const PropositionRef = builder
  .objectRef<{ id: string; nom: string; creeLe: Date; statut: StatutDemande }>(
    'Proposition'
  )
  .implement({
    fields: t => ({
      id: t.exposeID('id'),
      nom: t.exposeString('nom'),
      creeLe: t.expose('creeLe', { type: 'DateTime' }),
      statut: t.expose('statut', { type: StatutDemandeEnum }),
    }),
  })

// ── Contrôles ────────────────────────────────────────────────────────────────

/**
 * La demande, si elle relève d'une activité que la personne administre. Une demande
 * inconnue, d'une autre organisation ou d'une autre activité donne le même refus.
 */
async function exigerDemande(ctx: AppContext, id: string | number) {
  if (ctx.organisation === null) throw accesRefuse()
  const demande = await prisma.demande.findFirst({
    where: { id: String(id), organisationId: ctx.organisation.id },
  })
  if (demande === null) throw accesRefuse()
  await ctx.exigerAdminDe(demande.activiteId)
  return demande
}

const DEJA_TRAITEE = 'Cette demande est déjà traitée.'

/** Refuse le traitement d'une demande dont la période est archivée. */
async function exigerPeriodeOuverte(ctx: AppContext, editionId: string) {
  const edition = await ctx.exigerEdition(editionId)
  if (edition.statut === 'ARCHIVEE') {
    throw erreurSaisie(
      'Cette édition est archivée : ses demandes ne se traitent plus.'
    )
  }
  return edition
}

// ── Lecture ──────────────────────────────────────────────────────────────────

builder.queryFields(t => ({
  // Les demandes d'une période, les plus anciennes d'abord.
  demandes: t.prismaField({
    type: [DemandeRef],
    authScopes: { gestion: true },
    args: {
      editionId: t.arg.id({ required: true }),
      statut: t.arg({ type: StatutDemandeEnum }),
    },
    resolve: async (query, _root, args, ctx) => {
      const edition = await exigerAdminDeLEdition(ctx, args.editionId)
      return prisma.demande.findMany({
        ...query,
        where: {
          editionId: edition.id,
          ...(args.statut ? { statut: args.statut } : {}),
        },
        orderBy: { createdAt: 'asc' },
      })
    },
  }),

  // Les propositions que la personne connectée a faites pour un périmètre et une
  // période. Le filtre porte sur son identifiant : elle ne lit jamais celles des autres.
  mesPropositions: t.field({
    type: [PropositionRef],
    authScopes: { connecte: true },
    args: {
      perimetreId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const edition = await ctx.exigerEdition(args.editionId)
      const lignes = await prisma.demandePerimetre.findMany({
        where: {
          proposeParId: ctx.personne!.id,
          perimetreId: String(args.perimetreId),
          demande: {
            editionId: edition.id,
            organisationId: ctx.organisation!.id,
          },
        },
        select: {
          id: true,
          createdAt: true,
          demande: { select: { nom: true, statut: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return lignes.map(l => ({
        id: l.id,
        nom: l.demande.nom,
        creeLe: l.createdAt,
        statut: l.demande.statut,
      }))
    },
  }),
}))

// ── Écriture ─────────────────────────────────────────────────────────────────

builder.mutationFields(t => ({
  // Un·e référent·e propose une personne pour son périmètre. La réponse est la même
  // que l'adresse soit inconnue, déjà membre ou déjà en attente : la proposition ne
  // dit rien de l'annuaire.
  proposerPersonne: t.boolean({
    authScopes: { connecte: true },
    args: {
      perimetreId: t.arg.id({ required: true }),
      editionId: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      email: t.arg.string({ required: true }),
      mot: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const perimetreId = String(args.perimetreId)
      const editionId = String(args.editionId)
      // Même contrôle qu'une écriture : référent·e du périmètre pour la période, ou
      // admin de l'activité, sur une période non archivée.
      const acteur = await exigerEcriture(ctx, perimetreId, editionId)
      const email = adresseValide(args.email)
      const nom = texteRequis(args.nom, 'Le nom', 120)
      const mot = motValide(args.mot)
      const edition = await ctx.exigerEdition(editionId)
      const organisationId = ctx.organisation!.id

      // Deux propositions simultanées de la même adresse créent la demande deux
      // fois : la seconde se rejoue et s'ajoute à la demande de la première.
      const nouvelle = await rejouerSurDoublon(() =>
        prisma.$transaction(async tx => {
          // Le verrou sur la personne rend le plafond exact.
          await tx.$queryRaw`SELECT id FROM User WHERE id = ${acteur.id} FOR UPDATE`
          const enAttente = await tx.demandePerimetre.count({
            where: {
              proposeParId: acteur.id,
              demande: { organisationId, statut: 'EN_ATTENTE' },
            },
          })
          if (enAttente >= PROPOSITIONS_EN_ATTENTE_MAX) {
            throw erreurSaisie(
              `Vous avez déjà ${PROPOSITIONS_EN_ATTENTE_MAX} propositions en attente. Un admin doit d’abord les traiter.`
            )
          }
          const ligne = { perimetreId, proposeParId: acteur.id, mot }
          const demande = await tx.demande.findUnique({
            where: {
              editionId_adresseEnAttente: {
                editionId,
                adresseEnAttente: email,
              },
            },
            select: {
              id: true,
              perimetres: { where: { perimetreId }, select: { id: true } },
            },
          })
          if (demande === null) {
            await tx.demande.create({
              data: {
                organisationId,
                activiteId: edition.activiteId,
                editionId,
                origine: 'PROPOSITION',
                nom,
                adresse: email,
                adresseEnAttente: email,
                perimetres: { create: ligne },
              },
            })
            return true
          }
          if (demande.perimetres.length > 0) return false
          await tx.demandePerimetre.create({
            data: { demandeId: demande.id, ...ligne },
          })
          return true
        })
      )
      if (nouvelle) {
        await signalerDemande(prisma, {
          organisationId,
          activiteId: edition.activiteId,
          acteurId: acteur.id,
        })
      }
      return true
    },
  }),

  // La personne retire une proposition qu'elle a faite, tant que la demande attend.
  // Une proposition inconnue, d'une autre personne ou déjà traitée ne change rien.
  retirerProposition: t.boolean({
    authScopes: { connecte: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const ligne = await prisma.demandePerimetre.findFirst({
        where: {
          id: String(id),
          proposeParId: ctx.personne!.id,
          demande: {
            organisationId: ctx.organisation!.id,
            statut: 'EN_ATTENTE',
          },
        },
        select: { id: true, demandeId: true },
      })
      if (ligne === null) return false
      await prisma.$transaction(async tx => {
        await tx.demandePerimetre.delete({ where: { id: ligne.id } })
        // Une demande née d'une proposition disparaît avec son dernier périmètre.
        await tx.demande.deleteMany({
          where: {
            id: ligne.demandeId,
            origine: 'PROPOSITION',
            statut: 'EN_ATTENTE',
            perimetres: { none: {} },
          },
        })
      })
      return true
    },
  }),

  // L'admin accepte la demande : le compte naît ou se rattache, les périmètres
  // choisis deviennent des affectations, et les autres périmètres demandés des
  // souhaits. Tout s'écrit ensemble.
  accepterDemande: t.prismaField({
    type: DemandeRef,
    authScopes: { gestion: true },
    args: {
      id: t.arg.id({ required: true }),
      affecter: t.arg.idList({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const demande = await exigerDemande(ctx, args.id)
      await exigerPeriodeOuverte(ctx, demande.editionId)
      const affecter = await perimetresSouhaitesValides(
        args.affecter,
        demande.activiteId
      )
      const organisationId = demande.organisationId
      // Le même instant date les affectations et choisit la fenêtre du mail d'équipe.
      const instant = new Date()
      const { compte, creees } = await rejouerSurDoublon(() =>
        prisma.$transaction(async tx => {
          // Deux admins peuvent accepter en même temps : le verrou sérialise, et le
          // second lit une demande déjà traitée.
          const [verrou] = await tx.$queryRaw<
            { statut: string }[]
          >`SELECT statut FROM Demande WHERE id = ${demande.id} FOR UPDATE`
          if (verrou?.statut !== 'EN_ATTENTE') throw erreurSaisie(DEJA_TRAITEE)
          const compte = await creerOuRattacherCompte(tx, {
            email: demande.adresse,
            nom: demande.nom,
            organisationId,
            role: 'MEMBRE',
          })
          if (compte.issue === 'archive') {
            throw erreurSaisie('Cette adresse ne peut pas être invitée.')
          }
          const { userId } = compte
          const { creees } = await creerAffectations(tx, {
            userId,
            perimetreIds: affecter,
            editionId: demande.editionId,
            creeParId: ctx.personne!.id,
            instant,
          })
          await noterLesAutresSouhaits(tx, demande, userId, affecter)
          await tx.demande.update({
            where: { id: demande.id },
            data: {
              statut: 'ACCEPTEE',
              traiteeParId: ctx.personne!.id,
              traiteeLe: instant,
              userId,
              adresseEnAttente: null,
            },
          })
          return { compte, creees }
        })
      )
      journal.info(
        {
          evenement: 'demande-acceptee',
          demandeId: demande.id,
          userId: compte.userId,
          compte: compte.issue,
          affectations: creees.length,
          par: ctx.personne?.id,
        },
        'Une demande a été acceptée.'
      )
      // Une personne invitée reçoit l'invitation, qui liste déjà ses périmètres. Une
      // personne déjà membre apprend sa nouvelle place par le mail d'équipe (ADR 0012).
      if (compte.issue === 'membre') {
        if (creees.length > 0) {
          await annoncerChangementEquipe(compte.userId, {
            organisationId,
            activiteId: demande.activiteId,
            instant,
          })
        }
      } else {
        await mettreEnFile(
          'invitation',
          { userId: compte.userId },
          { organisationId, activiteId: demande.activiteId }
        )
      }
      return prisma.demande.findUniqueOrThrow({
        ...query,
        where: { id: demande.id },
      })
    },
  }),

  // L'admin refuse la demande. Aucun compte n'est créé et aucun mail ne part.
  refuserDemande: t.prismaField({
    type: DemandeRef,
    authScopes: { gestion: true },
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, args, ctx) => {
      const demande = await exigerDemande(ctx, args.id)
      await exigerPeriodeOuverte(ctx, demande.editionId)
      const { count } = await prisma.demande.updateMany({
        where: { id: demande.id, statut: 'EN_ATTENTE' },
        data: {
          statut: 'REFUSEE',
          traiteeParId: ctx.personne!.id,
          traiteeLe: new Date(),
          adresseEnAttente: null,
        },
      })
      if (count === 0) throw erreurSaisie(DEJA_TRAITEE)
      journal.info(
        {
          evenement: 'demande-refusee',
          demandeId: demande.id,
          par: ctx.personne?.id,
        },
        'Une demande a été refusée.'
      )
      return prisma.demande.findUniqueOrThrow({
        ...query,
        where: { id: demande.id },
      })
    },
  }),
}))

/**
 * Les périmètres demandés que l'admin n'a pas affectés deviennent des souhaits, dans
 * la limite du nombre de souhaits d'une personne. Un périmètre archivé est écarté.
 */
async function noterLesAutresSouhaits(
  tx: Prisma.TransactionClient,
  demande: { id: string; editionId: string },
  userId: string,
  affectes: string[]
) {
  const [demandes, dejaSouhaites] = await Promise.all([
    tx.demandePerimetre.findMany({
      where: {
        demandeId: demande.id,
        perimetreId: { notIn: affectes },
        perimetre: { archivedAt: null },
      },
      select: { perimetreId: true },
      orderBy: { createdAt: 'asc' },
    }),
    tx.souhait.count({ where: { userId, editionId: demande.editionId } }),
  ])
  const places = Math.max(SOUHAITS_MAX - dejaSouhaites, 0)
  const data = demandes.slice(0, places).map(d => ({
    userId,
    perimetreId: d.perimetreId,
    editionId: demande.editionId,
  }))
  if (data.length > 0)
    await tx.souhait.createMany({ data, skipDuplicates: true })
}
