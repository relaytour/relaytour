import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { empreinteJeton } from '../lib/abonnements-agenda.ts'
import { coordonneesLisibles } from '../lib/benevoles.ts'
import { referencePublique } from '../lib/candidatures.ts'
import type { AdressesDeRole } from '../lib/contenu.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import {
  notifierRetrait,
  placesAVenir,
  relancer,
} from '../lib/espace-benevole.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { descriptionPubliable } from '../lib/formulaire.ts'
import { heureLocale } from '../lib/heures.ts'
import { calendrier } from '../lib/ics.ts'
import { journal } from '../lib/journal.ts'
import { configurationActivite } from '../lib/organisation.ts'

import { builder } from './builder.ts'

// Espace bénévole (ADR 0041). Le lien personnel d'une fiche ouvre ses places à
// venir, sans session. La personne y confirme sa participation, quitte une place
// ou supprime sa fiche. L'espace ne montre ni l'adresse ni le téléphone, et aucun
// identifiant de la base : une place se désigne par une référence calculée.

const JETON = /^[A-Za-z0-9_-]{43}$/
const INCONNU = 'Ce lien n’est plus valable.'

interface PlaceDeLEspace {
  ref: string
  titre: string
  debut: Date
  fin: Date
  lieu: string | null
  perimetre: string | null
  consignes: string | null
  confirmee: boolean
}

interface Espace {
  benevoleId: string
  organisationId: string
  activiteId: string
  organisation: string
  activite: string
  nom: string
  confirme: boolean
  contact: string | null
  fuseau: string
  places: PlaceDeLEspace[]
  /** Les places, par référence. */
  placeIds: Map<string, string>
  ics: string
}

/** La fiche d'un jeton, si l'organisation est active. Sinon null. */
async function espace(
  jeton: string,
  maintenant = new Date()
): Promise<Espace | null> {
  if (!JETON.test(jeton)) return null
  const empreinte = empreinteJeton(jeton)
  const fiche = await prisma.benevole.findFirst({
    where: {
      espaceEmpreinte: empreinte,
      organisation: { statut: 'ACTIVE' },
    },
    include: {
      activite: { select: { nom: true } },
      organisation: { select: { fuseauHoraire: true } },
    },
  })
  if (fiche === null) return null
  const configuration = await configurationActivite(fiche.activiteId)
  const role: AdressesDeRole = {
    domaines: configuration.domainesCourrielAutorises,
    adresses: configuration.adressesRoleAutorisees,
  }
  const places = await placesAVenir(prisma, fiche.id, maintenant)
  const lues = places.map(p => ({
    id: p.id,
    ref: referencePublique(empreinte, p.id),
    titre: p.sequence.titre,
    debut: p.sequence.debut,
    fin: p.sequence.fin,
    lieu: p.sequence.lieu?.nom ?? null,
    perimetre: p.sequence.perimetre?.nom ?? null,
    consignes: descriptionPubliable(p.sequence.consignesBenevoles, role),
    confirmee: p.confirmeeLe !== null,
    version: p.sequence.version,
    modifieLe: p.sequence.updatedAt,
  }))
  return {
    benevoleId: fiche.id,
    organisationId: fiche.organisationId,
    activiteId: fiche.activiteId,
    organisation: configuration.nomCourt,
    activite: fiche.activite.nom,
    nom: fiche.nom,
    confirme: fiche.courrielConfirmeLe !== null,
    contact: configuration.contactRecrutement ?? null,
    fuseau: fiche.organisation.fuseauHoraire,
    places: lues,
    placeIds: new Map(lues.map(p => [p.ref, p.id])),
    // Le fichier ne porte pas le lien personnel : il circule hors de l'espace.
    ics: calendrier({
      methode: 'PUBLISH',
      maintenant,
      nom: `${fiche.activite.nom} : mes places`,
      evenements: lues.map(p => ({
        uid: `place-${p.id}@relaytour`,
        titre: p.titre,
        horaire: { debut: p.debut, fin: p.fin },
        lieu: p.lieu,
        description: p.consignes,
        sequence: p.version,
        modifieLe: p.modifieLe,
      })),
    }),
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

const PlaceDeLEspaceRef = builder
  .objectRef<PlaceDeLEspace & { fuseau: string }>('PlaceDeLEspace')
  .implement({
    fields: t => ({
      ref: t.exposeString('ref'),
      titre: t.exposeString('titre'),
      jour: t.string({ resolve: p => heureLocale(p.debut, p.fuseau).jour }),
      jourFin: t.string({ resolve: p => heureLocale(p.fin, p.fuseau).jour }),
      heureDebut: t.string({
        resolve: p => heureLocale(p.debut, p.fuseau).heure,
      }),
      heureFin: t.string({ resolve: p => heureLocale(p.fin, p.fuseau).heure }),
      lieu: t.exposeString('lieu', { nullable: true }),
      perimetre: t.exposeString('perimetre', { nullable: true }),
      consignes: t.exposeString('consignes', { nullable: true }),
      confirmee: t.exposeBoolean('confirmee'),
    }),
  })

const EspaceRef = builder.objectRef<Espace>('EspaceBenevole').implement({
  description:
    'L’espace d’une ou d’un bénévole, ouvert par son lien personnel (ADR 0041). Lisible sans session.',
  fields: t => ({
    organisation: t.exposeString('organisation'),
    activite: t.exposeString('activite'),
    nom: t.exposeString('nom'),
    confirme: t.exposeBoolean('confirme', {
      description: 'Vrai quand la personne a confirmé sa participation.',
    }),
    contact: t.exposeString('contact', { nullable: true }),
    places: t.field({
      type: [PlaceDeLEspaceRef],
      resolve: e => e.places.map(p => ({ ...p, fuseau: e.fuseau })),
    }),
    ics: t.exposeString('ics', {
      description: 'Les places à venir au format iCalendar, à télécharger.',
    }),
  }),
})

// ── Lecture ──────────────────────────────────────────────────────────────────

builder.queryField('espaceBenevole', t =>
  t.field({
    type: EspaceRef,
    nullable: true,
    description:
      'L’espace d’une fiche bénévole, ou null pour un lien inconnu ou révoqué. Lisible sans session ; l’ouverture ne confirme rien.',
    args: { jeton: t.arg.string({ required: true }) },
    resolve: (_root, args) => espace(args.jeton),
  })
)

// ── Gestes de la personne ────────────────────────────────────────────────────

/** L'espace du jeton, ou un refus qui ne dit pas pourquoi. */
async function exigerEspace(jeton: string): Promise<Espace> {
  const lu = await espace(jeton)
  if (lu === null) throw erreurSaisie(INCONNU)
  return lu
}

const signalProgramme = (e: Espace) =>
  publierPourActivite('PROGRAMME', e.organisationId, e.activiteId)

builder.mutationFields(t => ({
  confirmerParticipation: t.boolean({
    description:
      'Confirme l’adresse de la fiche et toutes ses places à confirmer. Utilisable sans session.',
    args: { jeton: t.arg.string({ required: true }) },
    resolve: async (_root, args) => {
      const lu = await exigerEspace(args.jeton)
      const maintenant = new Date()
      await prisma.$transaction(async tx => {
        await tx.benevole.updateMany({
          where: { id: lu.benevoleId, courrielConfirmeLe: null },
          data: { courrielConfirmeLe: maintenant },
        })
        await tx.placeSequence.updateMany({
          where: { benevoleId: lu.benevoleId, confirmeeLe: null },
          data: { confirmeeLe: maintenant },
        })
      })
      journal.info(
        { evenement: 'benevole-confirme', activiteId: lu.activiteId },
        'Une ou un bénévole a confirmé sa participation.'
      )
      signalProgramme(lu)
      publierPourActivite('CANDIDATURE', lu.organisationId, lu.activiteId)
      return true
    },
  }),

  quitterPlace: t.boolean({
    description:
      'Retire la personne d’une place à venir et prévient l’équipe. Une fiche non confirmée qu’aucune place ne retient est supprimée. Utilisable sans session.',
    args: {
      jeton: t.arg.string({ required: true }),
      ref: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      const lu = await exigerEspace(args.jeton)
      const placeId = lu.placeIds.get(args.ref)
      if (placeId === undefined)
        throw erreurSaisie('Cette place n’existe plus.')
      const place = await prisma.placeSequence.findUniqueOrThrow({
        where: { id: placeId },
        include: {
          sequence: {
            select: {
              id: true,
              organisationId: true,
              activiteId: true,
              editionId: true,
              perimetreId: true,
            },
          },
        },
      })
      await prisma.$transaction(async tx => {
        await tx.placeSequence.delete({ where: { id: place.id } })
        await tx.sequence.update({
          where: { id: place.sequenceId },
          data: { version: { increment: 1 } },
        })
      })
      await notifierRetrait(prisma, {
        placeId: place.id,
        benevoleId: lu.benevoleId,
        sequence: place.sequence,
      })
      // Une personne qui décline tout avant de confirmer ne laisse aucune fiche.
      if (!lu.confirme) {
        await prisma.benevole.deleteMany({
          where: { id: lu.benevoleId, places: { none: {} } },
        })
      }
      publierPourActivite(
        'PROGRAMME',
        place.sequence.organisationId,
        place.sequence.activiteId,
        {
          id: place.sequence.id,
          perimetreId: place.sequence.perimetreId,
          editionId: place.sequence.editionId,
        }
      )
      return true
    },
  }),

  supprimerMaFiche: t.boolean({
    description:
      'Supprime la fiche de la personne, avec ses plages. Refusé tant qu’une place à venir la retient. Utilisable sans session.',
    args: { jeton: t.arg.string({ required: true }) },
    resolve: async (_root, args) => {
      const lu = await exigerEspace(args.jeton)
      if (lu.places.length > 0) {
        throw erreurSaisie(
          'Quittez d’abord vos places à venir, puis supprimez votre fiche.'
        )
      }
      await prisma.benevole.delete({ where: { id: lu.benevoleId } })
      journal.info(
        {
          evenement: 'benevole-supprime-par-lui-meme',
          activiteId: lu.activiteId,
        },
        'Une ou un bénévole a supprimé sa fiche.'
      )
      signalProgramme(lu)
      return true
    },
  }),

  // ── Geste de l'équipe ──────────────────────────────────────────────────────

  renvoyerLienBenevole: t.boolean({
    authScopes: { connecte: true },
    description:
      'Renvoie le lien personnel d’une fiche née d’une candidature, une seule fois. Le nouveau lien remplace l’ancien. Réservé aux personnes qui lisent ses coordonnées.',
    args: { benevoleId: t.arg.id({ required: true }) },
    resolve: async (_root, args, ctx: AppContext) => {
      const fiche = await prisma.benevole.findFirst({
        where: {
          id: String(args.benevoleId),
          organisationId: ctx.organisation!.id,
        },
        select: { id: true, organisationId: true, activiteId: true },
      })
      if (fiche === null) throw accesRefuse()
      await ctx.exigerActivite(fiche.activiteId)
      const lisibles = await coordonneesLisibles(ctx, fiche.activiteId, [
        fiche.id,
      ])
      if (!lisibles.has(fiche.id)) throw accesRefuse()
      const envoye = await relancer(prisma, {
        benevoleId: fiche.id,
        organisationId: fiche.organisationId,
        activiteId: fiche.activiteId,
      })
      if (!envoye) {
        throw erreurSaisie(
          'Ce lien ne peut pas être renvoyé : il a déjà été renvoyé une fois, ou la fiche n’a pas reçu de premier lien.'
        )
      }
      publierPourActivite('PROGRAMME', fiche.organisationId, fiche.activiteId)
      return true
    },
  }),
}))
