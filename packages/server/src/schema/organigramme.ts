import {
  prisma,
  type AdressesOrganigramme,
  type Edition,
  type Perimetre,
} from '@relaytour/database'

import { membreActif } from '../lib/appartenances.ts'
import { publierPourActivite } from '../lib/flux.ts'

import { AdressesOrganigrammeEnum } from './activites.ts'
import { builder } from './builder.ts'
import { configurationDe } from './identite.ts'
import { EditionRef, PerimetreRef } from './organisation.ts'
import { PersonneRef } from './personnes.ts'

// Organigramme d'une activité (ADR 0035) : le contact de l'activité, ses admins,
// puis chaque périmètre avec son contact principal et ses référentes et référents
// de la période. Une personne qui découvre l'activité sans la voir lit seulement
// les admins et les contacts principaux. Une adresse personnelle ne s'affiche que
// pour une personne qui voit l'activité, si le réglage de l'activité et l'accord
// de la personne concernée l'autorisent tous les deux.

type Place = 'admin' | 'contact' | 'referent'

interface MembreOrganigramme {
  id: string
  nom: string
  adresse: string | null
  contactPrincipal: boolean
  moi: boolean
}

interface PerimetreOrganigramme {
  perimetre: Perimetre
  referents: MembreOrganigramme[]
}

interface Organigramme {
  edition: Edition | null
  complet: boolean
  adresses: AdressesOrganigramme
  contactActivite: string | null
  admins: MembreOrganigramme[]
  perimetres: PerimetreOrganigramme[]
}

/** Vrai si le réglage de l'activité ouvre l'adresse d'une personne à cette place. */
export function adresseOuverte(
  reglage: AdressesOrganigramme,
  place: Place
): boolean {
  if (reglage === 'AUCUNE') return false
  if (reglage === 'CONTACTS') return place !== 'referent'
  return true
}

const MembreOrganigrammeRef = builder
  .objectRef<MembreOrganigramme>('MembreOrganigramme')
  .implement({
    fields: t => ({
      id: t.exposeID('id'),
      nom: t.exposeString('nom'),
      adresse: t.exposeString('adresse', {
        nullable: true,
        description:
          'L’adresse de la personne, si le réglage de l’activité et son accord l’autorisent, pour une personne qui voit l’activité. Nulle sinon.',
      }),
      contactPrincipal: t.exposeBoolean('contactPrincipal'),
      moi: t.exposeBoolean('moi', {
        description: 'Vrai pour la personne connectée.',
      }),
    }),
  })

const PerimetreOrganigrammeRef = builder
  .objectRef<PerimetreOrganigramme>('PerimetreOrganigramme')
  .implement({
    fields: t => ({
      perimetre: t.field({ type: PerimetreRef, resolve: p => p.perimetre }),
      referents: t.field({
        type: [MembreOrganigrammeRef],
        description:
          'Le contact principal en tête, puis les autres référentes et référents de la période par ordre alphabétique. Une personne en découverte ne lit que le contact principal.',
        resolve: p => p.referents,
      }),
    }),
  })

const OrganigrammeRef = builder
  .objectRef<Organigramme>('Organigramme')
  .implement({
    fields: t => ({
      edition: t.field({
        type: EditionRef,
        nullable: true,
        description:
          'La période en préparation ou en cours la plus récente, comme pour « Tous les périmètres ».',
        resolve: o => o.edition,
      }),
      complet: t.exposeBoolean('complet', {
        description:
          'Vrai si la personne voit l’activité : elle lit alors toutes les référentes et tous les référents, et les adresses ouvertes.',
      }),
      adresses: t.expose('adresses', { type: AdressesOrganigrammeEnum }),
      contactActivite: t.exposeString('contactActivite', {
        nullable: true,
        description:
          'Le contact de l’activité, une adresse de rôle, sinon celui de l’organisation.',
      }),
      admins: t.field({
        type: [MembreOrganigrammeRef],
        resolve: o => o.admins,
      }),
      perimetres: t.field({
        type: [PerimetreOrganigrammeRef],
        resolve: o => o.perimetres,
      }),
    }),
  })

const triParNom = (a: { nom: string }, b: { nom: string }) =>
  a.nom.localeCompare(b.nom, 'fr')

builder.queryFields(t => ({
  organigramme: t.field({
    type: OrganigrammeRef,
    authScopes: { connecte: true },
    args: { activiteId: t.arg.id() },
    resolve: async (_root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const id = await ctx.exigerActiviteDecouverte(args.activiteId)
      const complet = (await ctx.activitesVisibles()).has(id)
      const moi = ctx.personne!.id
      // Une personne archivée dans l'organisation (ADR 0031), ou qui n'y appartient
      // plus, n'apparaît pas.
      const compte = {
        id: true,
        name: true,
        email: true,
        appartenances: {
          where: { organisationId },
          select: { adresseVisible: true },
        },
      } as const
      const actif = membreActif(organisationId)
      const [activite, edition, perimetres, admins] = await Promise.all([
        prisma.activite.findUniqueOrThrow({ where: { id } }),
        prisma.edition.findFirst({
          where: { activiteId: id, statut: { not: 'ARCHIVEE' } },
          orderBy: { annee: 'desc' },
        }),
        prisma.perimetre.findMany({
          where: { activiteId: id, archivedAt: null },
          orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
        }),
        prisma.adminActivite.findMany({
          where: { activiteId: id, user: actif },
          select: { user: { select: compte } },
        }),
      ])
      const affectations =
        edition === null
          ? []
          : await prisma.affectation.findMany({
              where: {
                editionId: edition.id,
                perimetre: { activiteId: id, archivedAt: null },
                user: actif,
                // Une personne en découverte ne lit que les contacts principaux.
                ...(complet ? {} : { contactPrincipal: true }),
              },
              select: {
                perimetreId: true,
                contactPrincipal: true,
                user: { select: compte },
              },
            })

      const membre = (
        u: {
          id: string
          name: string
          email: string
          appartenances: { adresseVisible: boolean }[]
        },
        place: Place
      ): MembreOrganigramme => ({
        id: u.id,
        nom: u.name,
        adresse:
          complet &&
          u.appartenances[0]?.adresseVisible === true &&
          adresseOuverte(activite.adressesOrganigramme, place)
            ? u.email
            : null,
        contactPrincipal: place === 'contact',
        moi: u.id === moi,
      })

      const parPerimetre = new Map<string, MembreOrganigramme[]>()
      for (const a of affectations) {
        const liste = parPerimetre.get(a.perimetreId) ?? []
        liste.push(membre(a.user, a.contactPrincipal ? 'contact' : 'referent'))
        parPerimetre.set(a.perimetreId, liste)
      }
      const configuration = await configurationDe(activite, organisationId)
      return {
        edition,
        complet,
        adresses: activite.adressesOrganigramme,
        contactActivite: configuration.contactRecrutement ?? null,
        admins: admins.map(a => membre(a.user, 'admin')).sort(triParNom),
        perimetres: perimetres.map(perimetre => ({
          perimetre,
          referents: (parPerimetre.get(perimetre.id) ?? []).sort(
            (a, b) =>
              Number(b.contactPrincipal) - Number(a.contactPrincipal) ||
              triParNom(a, b)
          ),
        })),
      }
    },
  }),
}))

// L'accord de la personne vaut pour son organisation active (ADR 0035). Elle seule
// le lit et le change : toute autre personne lit null.
builder.prismaObjectFields(PersonneRef, t => ({
  adresseVisible: t.boolean({
    nullable: true,
    select: (_args, ctx) => ({
      appartenances: {
        where: { organisationId: ctx.organisation?.id ?? '' },
        select: { adresseVisible: true },
      },
    }),
    resolve: (u, _args, ctx) =>
      ctx.personne?.id === u.id
        ? (u.appartenances[0]?.adresseVisible ?? false)
        : null,
  }),
}))

builder.mutationFields(t => ({
  modifierMonAdresseVisible: t.boolean({
    authScopes: { connecte: true },
    args: { visible: t.arg.boolean({ required: true }) },
    resolve: async (_root, { visible }, ctx) => {
      const organisationId = ctx.organisation!.id
      const userId = ctx.personne!.id
      await prisma.appartenance.update({
        where: { userId_organisationId: { userId, organisationId } },
        data: { adresseVisible: visible },
      })
      // Les organigrammes où la personne figure se relisent (ADR 0017).
      const activites = await prisma.activite.findMany({
        where: {
          organisationId,
          OR: [
            { admins: { some: { userId } } },
            { perimetres: { some: { affectations: { some: { userId } } } } },
          ],
        },
        select: { id: true },
      })
      for (const a of activites) {
        publierPourActivite('EQUIPE', organisationId, a.id)
      }
      return visible
    },
  }),
}))
