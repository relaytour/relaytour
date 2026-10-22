import {
  EtatAccesFournisseur,
  EtatCompteFournisseur,
  prisma,
} from '@relaytour/database'

import {
  perimetresDesLecteurs,
  SELECTION_LECTEURS,
} from '../espace-fichiers/droits.ts'
import { planifierVerificationAcces } from '../espace-fichiers/acces.ts'
import { membreActif } from '../lib/appartenances.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import { adresseValide } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { DossierLieRef } from './espace-fichiers.ts'
import { PerimetreRef } from './organisation.ts'

// Vérification des accès chez le fournisseur (ADR 0044). Ces lectures citent les
// adresses de toute l'équipe : elles suivent la règle de l'annuaire et sont
// réservées aux admins de l'organisation (ADR 0018).

const EtatAccesEnum = builder.enumType(EtatAccesFournisseur, {
  name: 'EtatAccesFournisseur',
  description:
    'A_ACCES : un droit couvre la personne. SANS_COMPTE : l’annuaire du fournisseur ne la connaît pas. SANS_ACCES : aucun droit ne la couvre. INCONNU : un groupe illisible la couvre peut-être. EN_TROP : un compte a un droit sans être attendu.',
})

const EtatCompteEnum = builder.enumType(EtatCompteFournisseur, {
  name: 'EtatCompteFournisseur',
})

interface PersonneAcces {
  id: string
  nom: string
  email: string
}

const PersonneAccesRef = builder
  .objectRef<PersonneAcces>('PersonneAcces')
  .implement({
    fields: t => ({
      id: t.exposeID('id'),
      nom: t.exposeString('nom'),
      email: t.exposeString('email'),
    }),
  })

interface LigneAcces {
  personne: PersonneAcces | null
  nom: string
  etat: EtatAccesFournisseur
  via: string | null
  perimetreIds: string[]
}

const LigneAccesRef = builder.objectRef<LigneAcces>('LigneAcces').implement({
  description:
    'Une personne face aux droits d’un dossier lié. Un accès en trop porte un nom, sans personne ni adresse.',
  fields: t => ({
    personne: t.field({
      type: PersonneAccesRef,
      nullable: true,
      resolve: l => l.personne,
    }),
    nom: t.exposeString('nom'),
    etat: t.expose('etat', { type: EtatAccesEnum }),
    via: t.exposeString('via', {
      nullable: true,
      description:
        '« direct », « domaine », ou « groupe: » suivi du nom du groupe chez le fournisseur.',
    }),
    perimetreIds: t.exposeIDList('perimetreIds', {
      description:
        'Les périmètres des lecteurs où la personne est affectée pour la période. Vide pour un admin de l’activité ou un accès en trop.',
    }),
  }),
})

interface VerificationDossier {
  dossierId: string
  verifieLe: Date | null
  lignes: LigneAcces[]
  perimetres: { id: string }[]
}

const VerificationDossierRef = builder
  .objectRef<VerificationDossier>('VerificationAccesDossier')
  .implement({
    fields: t => ({
      dossier: t.prismaField({
        type: DossierLieRef,
        resolve: (query, v) =>
          prisma.dossierLie.findUniqueOrThrow({
            ...query,
            where: { id: v.dossierId },
          }),
      }),
      verifieLe: t.expose('verifieLe', { type: 'DateTime', nullable: true }),
      lignes: t.field({ type: [LigneAccesRef], resolve: v => v.lignes }),
      perimetres: t.prismaField({
        type: [PerimetreRef],
        description: 'Les périmètres que les lecteurs du dossier désignent.',
        resolve: (query, v) =>
          prisma.perimetre.findMany({
            ...query,
            where: { id: { in: v.perimetres.map(p => p.id) } },
            orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
          }),
      }),
    }),
  })

interface CompteVue {
  personne: PersonneAcces
  etat: EtatCompteFournisseur | null
  adresseSaisie: string | null
  verifieLe: Date | null
}

const CompteVueRef = builder
  .objectRef<CompteVue>('CompteFournisseurVue')
  .implement({
    description:
      'Le compte d’un membre chez le fournisseur. Un état nul : la personne n’a pas encore été cherchée.',
    fields: t => ({
      personne: t.field({ type: PersonneAccesRef, resolve: c => c.personne }),
      etat: t.field({
        type: EtatCompteEnum,
        nullable: true,
        resolve: c => c.etat,
      }),
      adresseSaisie: t.exposeString('adresseSaisie', { nullable: true }),
      verifieLe: t.expose('verifieLe', { type: 'DateTime', nullable: true }),
    }),
  })

/** Le fournisseur de la connexion active de l'organisation, ou un refus. */
async function fournisseurConnecte(organisationId: string) {
  const connexion = await prisma.connexionFichiers.findUnique({
    where: { organisationId },
    select: { fournisseur: true },
  })
  if (connexion === null) {
    throw erreurSaisie('Aucun fournisseur cloud n’est connecté.')
  }
  return connexion.fournisseur
}

builder.queryFields(t => ({
  verificationAcces: t.field({
    type: [VerificationDossierRef],
    authScopes: { admin: true },
    description:
      'Les accès chez le fournisseur des dossiers liés d’une activité, à la dernière vérification (ADR 0044).',
    args: { activiteId: t.arg.id({ required: true }) },
    resolve: async (_root, { activiteId }, ctx) => {
      const organisationId = ctx.organisation!.id
      const activite = await prisma.activite.findFirst({
        where: { id: String(activiteId), organisationId },
        select: { id: true },
      })
      if (activite === null) throw accesRefuse()
      const fournisseur = await fournisseurConnecte(organisationId)
      const dossiers = await prisma.dossierLie.findMany({
        where: { organisationId, activiteId: activite.id, fournisseur },
        orderBy: [{ nom: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          activiteId: true,
          attendus: true,
          ...SELECTION_LECTEURS,
          etatsAcces: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      })
      const edition = await prisma.edition.findFirst({
        where: { activiteId: activite.id, statut: { not: 'ARCHIVEE' } },
        orderBy: { annee: 'desc' },
        select: { id: true },
      })
      const resultat: VerificationDossier[] = []
      for (const d of dossiers) {
        const designes =
          (await perimetresDesLecteurs(d)) ??
          (
            await prisma.perimetre.findMany({
              where: { activiteId: d.activiteId, archivedAt: null },
              select: { id: true },
            })
          ).map(p => p.id)
        const affectations =
          edition === null
            ? []
            : await prisma.affectation.findMany({
                where: {
                  editionId: edition.id,
                  perimetreId: { in: designes },
                  user: membreActif(organisationId),
                },
                select: { userId: true, perimetreId: true },
              })
        const perimetresDe = new Map<string, string[]>()
        for (const a of affectations) {
          perimetresDe.set(a.userId, [
            ...(perimetresDe.get(a.userId) ?? []),
            a.perimetreId,
          ])
        }
        resultat.push({
          dossierId: d.id,
          verifieLe: d.etatsAcces.reduce<Date | null>(
            (plus, e) =>
              plus === null || e.verifieLe > plus ? e.verifieLe : plus,
            null
          ),
          perimetres: designes.map(id => ({ id })),
          lignes: d.etatsAcces
            .map(e => ({
              personne:
                e.user === null
                  ? null
                  : { id: e.user.id, nom: e.user.name, email: e.user.email },
              nom: e.user?.name ?? e.nom ?? '',
              etat: e.etat,
              via: e.via,
              perimetreIds:
                e.userId === null ? [] : (perimetresDe.get(e.userId) ?? []),
            }))
            .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
        })
      }
      return resultat
    },
  }),

  comptesFournisseur: t.field({
    type: [CompteVueRef],
    authScopes: { admin: true },
    description:
      'Les membres de l’organisation et leur compte chez le fournisseur connecté (ADR 0044).',
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      const fournisseur = await fournisseurConnecte(organisationId)
      const membres = await prisma.user.findMany({
        where: membreActif(organisationId),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          email: true,
          comptesFournisseur: {
            where: { organisationId, fournisseur },
            select: { etat: true, adresseSaisie: true, verifieLe: true },
          },
        },
      })
      return membres.map(m => {
        const compte = m.comptesFournisseur[0]
        return {
          personne: { id: m.id, nom: m.name, email: m.email },
          etat: compte?.verifieLe == null ? null : compte.etat,
          adresseSaisie: compte?.adresseSaisie ?? null,
          verifieLe: compte?.verifieLe ?? null,
        }
      })
    },
  }),
}))

builder.mutationFields(t => ({
  verifierAccesFournisseur: t.boolean({
    authScopes: { admin: true },
    description:
      'Lance la vérification des accès chez le fournisseur. Le résultat arrive par le flux des changements.',
    resolve: async (_root, _args, ctx) => {
      const organisationId = ctx.organisation!.id
      const connexion = await prisma.connexionFichiers.findUnique({
        where: { organisationId },
        select: { etat: true, portee: true },
      })
      if (connexion?.etat !== 'ACTIVE') {
        throw erreurSaisie('Aucun fournisseur cloud n’est connecté.')
      }
      if (connexion.portee === 'FICHIERS') {
        throw erreurSaisie(
          'Reconnectez le fournisseur avec la vérification des accès.'
        )
      }
      planifierVerificationAcces(organisationId)
      return true
    },
  }),

  saisirAdresseFournisseur: t.field({
    type: CompteVueRef,
    authScopes: { admin: true },
    description:
      'Donne l’adresse du compte d’un membre chez le fournisseur, quand elle diffère de son adresse dans Relaytour. Null : Relaytour reprend son adresse.',
    args: {
      userId: t.arg.id({ required: true }),
      adresse: t.arg.string(),
    },
    resolve: async (_root, { userId, adresse }, ctx) => {
      const organisationId = ctx.organisation!.id
      const membre = await prisma.user.findFirst({
        where: { id: String(userId), ...membreActif(organisationId) },
        select: { id: true, name: true, email: true },
      })
      if (membre === null) throw accesRefuse()
      const fournisseur = await fournisseurConnecte(organisationId)
      const saisie =
        adresse === null || adresse === undefined || adresse.trim() === ''
          ? null
          : adresseValide(adresse)
      const compte = await prisma.compteFournisseur.upsert({
        where: {
          organisationId_fournisseur_userId: {
            organisationId,
            fournisseur,
            userId: membre.id,
          },
        },
        create: {
          organisationId,
          fournisseur,
          userId: membre.id,
          adresseSaisie: saisie,
        },
        // Le compte se cherche de nouveau à la vérification suivante.
        update: { adresseSaisie: saisie, verifieLe: null, identifiant: null },
      })
      planifierVerificationAcces(organisationId)
      return {
        personne: { id: membre.id, nom: membre.name, email: membre.email },
        etat: null,
        adresseSaisie: compte.adresseSaisie,
        verifieLe: null,
      }
    },
  }),
}))
