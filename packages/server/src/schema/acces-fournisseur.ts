import {
  AccesFournisseurDossier,
  ActionProposition,
  EtatAccesFournisseur,
  EtatCompteFournisseur,
  EtatProposition,
  prisma,
  RoleFournisseur,
} from '@relaytour/database'

import {
  perimetresDesLecteurs,
  SELECTION_LECTEURS,
} from '../espace-fichiers/droits.ts'
import { planifierVerificationAcces } from '../espace-fichiers/acces.ts'
import { erreurEspace, ouvrirEspace } from '../espace-fichiers/index.ts'
import { appliquerProposition } from '../espace-fichiers/propositions.ts'
import { journal } from '../lib/journal.ts'
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

const AccesFournisseurEnum = builder.enumType(AccesFournisseurDossier, {
  name: 'AccesFournisseurDossier',
  description:
    'Comment Relaytour propose les accès d’un dossier lié chez le fournisseur : rien, un partage du dossier, ou l’entrée dans un groupe (ADR 0044).',
})
const RoleFournisseurEnum = builder.enumType(RoleFournisseur, {
  name: 'RoleFournisseur',
})
const ActionPropositionEnum = builder.enumType(ActionProposition, {
  name: 'ActionProposition',
})
const EtatPropositionEnum = builder.enumType(EtatProposition, {
  name: 'EtatProposition',
})

builder.prismaObjectFields(DossierLieRef, t => ({
  accesFournisseur: t.expose('accesFournisseur', {
    type: AccesFournisseurEnum,
  }),
  groupeFournisseurNom: t.exposeString('groupeFournisseurNom', {
    nullable: true,
  }),
  roleFournisseur: t.expose('roleFournisseur', { type: RoleFournisseurEnum }),
  ajoutsAutomatiques: t.exposeBoolean('ajoutsAutomatiques'),
  invitationFournisseur: t.exposeBoolean('invitationFournisseur'),
  groupeFournisseurId: t.exposeID('groupeFournisseurId', { nullable: true }),
  accesCrees: t.int({
    description:
      'Les accès que Relaytour a créés pour ce dossier chez le fournisseur. Zéro pour une personne qui n’est pas admin de l’organisation.',
    resolve: (d, _args, ctx) =>
      ctx.personne?.estAdmin === true
        ? prisma.permissionCreee.count({ where: { dossierLieId: d.id } })
        : 0,
  }),
}))

interface PropositionVue {
  id: string
  action: ActionProposition
  etat: EtatProposition
  erreur: string | null
  personne: PersonneAcces
  cible: string
  parGroupe: boolean
}

const PropositionRef = builder
  .objectRef<PropositionVue>('PropositionAcces')
  .implement({
    description:
      'Un ajout ou un retrait d’accès chez le fournisseur, qu’un admin applique ou écarte (ADR 0044).',
    fields: t => ({
      id: t.exposeID('id'),
      action: t.expose('action', { type: ActionPropositionEnum }),
      etat: t.expose('etat', { type: EtatPropositionEnum }),
      erreur: t.exposeString('erreur', { nullable: true }),
      personne: t.field({ type: PersonneAccesRef, resolve: p => p.personne }),
      parGroupe: t.exposeBoolean('parGroupe', {
        description: 'Vrai quand la proposition vise un groupe du fournisseur.',
      }),
      cible: t.exposeString('cible', {
        description:
          'Le droit visé : « partage du dossier », ou le groupe. Un retrait nomme le droit que Relaytour a créé, quel que soit le mode actuel du dossier.',
      }),
    }),
  })

interface GroupeDuDossier {
  identifiant: string
  nom: string
}

const GroupeDuDossierRef = builder
  .objectRef<GroupeDuDossier>('GroupeDuDossier')
  .implement({
    fields: t => ({
      identifiant: t.exposeID('identifiant'),
      nom: t.exposeString('nom'),
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
      // Les listes d'un dossier restent courtes : une équipe, quelques groupes.
      lignes: t.field({
        type: [LigneAccesRef],
        complexity: { field: 1, multiplier: 3 },
        resolve: v => v.lignes,
      }),
      propositions: t.field({
        type: [PropositionRef],
        complexity: { field: 1, multiplier: 2 },
        description:
          'Les propositions en attente, et celles qui ont échoué, du plus ancien au plus récent.',
        resolve: async v => {
          const [propositions, dossier, creees] = await Promise.all([
            prisma.propositionAcces.findMany({
              where: {
                dossierLieId: v.dossierId,
                etat: { in: ['EN_ATTENTE', 'ECHEC'] },
              },
              orderBy: [{ creeLe: 'asc' }, { id: 'asc' }],
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            }),
            prisma.dossierLie.findUniqueOrThrow({
              where: { id: v.dossierId },
              select: {
                accesFournisseur: true,
                groupeFournisseurId: true,
                groupeFournisseurNom: true,
              },
            }),
            prisma.permissionCreee.findMany({
              where: { dossierLieId: v.dossierId },
              select: { userId: true, identifiant: true },
            }),
          ])
          const groupe = (id: string) => ({
            parGroupe: true,
            cible: `groupe « ${id === dossier.groupeFournisseurId ? (dossier.groupeFournisseurNom ?? id) : id} »`,
          })
          const partage = { parGroupe: false, cible: 'partage du dossier' }
          const cible = (action: ActionProposition, userId: string) => {
            if (action === 'RETIRER') {
              const creee = creees.find(c => c.userId === userId)
              return creee?.identifiant.startsWith('groupe:') === true
                ? groupe(creee.identifiant.slice('groupe:'.length))
                : partage
            }
            return dossier.accesFournisseur === 'GROUPE' &&
              dossier.groupeFournisseurId !== null
              ? groupe(dossier.groupeFournisseurId)
              : partage
          }
          return propositions.map(p => ({
            id: p.id,
            action: p.action,
            etat: p.etat,
            erreur: p.erreur,
            personne: { id: p.user.id, nom: p.user.name, email: p.user.email },
            ...cible(p.action, p.userId),
          }))
        },
      }),
      perimetres: t.prismaField({
        type: [PerimetreRef],
        complexity: { field: 1, multiplier: 2 },
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

  groupesDuDossier: t.field({
    type: [GroupeDuDossierRef],
    authScopes: { admin: true },
    description:
      'Les groupes du fournisseur qui ont un droit sur un dossier lié et dont Relaytour peut gérer les membres (ADR 0044).',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const dossier = await prisma.dossierLie.findFirst({
        where: { id: String(id), organisationId: ctx.organisation!.id },
      })
      if (dossier === null) throw accesRefuse()
      return groupesGerables(ctx.organisation!.id, dossier)
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
  reglerAccesFournisseur: t.prismaField({
    type: DossierLieRef,
    authScopes: { admin: true },
    description:
      'Règle comment Relaytour propose les accès d’un dossier lié chez le fournisseur. Un partage ou un groupe exige une connexion qui gère les accès (ADR 0044).',
    args: {
      id: t.arg.id({ required: true }),
      mode: t.arg({ type: AccesFournisseurEnum, required: true }),
      groupeId: t.arg.id(),
      role: t.arg({ type: RoleFournisseurEnum, required: true }),
      ajoutsAutomatiques: t.arg.boolean({ required: true }),
      invitation: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const dossier = await prisma.dossierLie.findFirst({
        where: { id: String(args.id), organisationId },
      })
      if (dossier === null) throw accesRefuse()
      let groupe: GroupeDuDossier | null = null
      if (args.mode !== 'AUCUN') {
        const connexion = await prisma.connexionFichiers.findUnique({
          where: { organisationId },
          select: { portee: true, etat: true },
        })
        if (connexion?.etat !== 'ACTIVE' || connexion.portee !== 'GESTION') {
          throw erreurSaisie(
            'Activez d’abord la gestion des accès en reconnectant le fournisseur.'
          )
        }
      }
      if (args.mode === 'GROUPE') {
        const groupes = await groupesGerables(organisationId, dossier)
        groupe =
          groupes.find(g => g.identifiant === String(args.groupeId ?? '')) ??
          null
        if (groupe === null) {
          throw erreurSaisie(
            'Choisissez un groupe qui a déjà un droit sur ce dossier.'
          )
        }
      }
      await prisma.dossierLie.update({
        where: { id: dossier.id },
        data: {
          accesFournisseur: args.mode,
          groupeFournisseurId: groupe?.identifiant ?? null,
          groupeFournisseurNom: groupe?.nom ?? null,
          roleFournisseur: args.role,
          ajoutsAutomatiques: args.mode !== 'AUCUN' && args.ajoutsAutomatiques,
          invitationFournisseur: args.invitation,
        },
      })
      journal.info(
        {
          evenement: 'acces-fournisseur-regle',
          organisationId,
          dossierLieId: dossier.id,
          mode: args.mode,
          acteurId: ctx.personne!.id,
        },
        'Le mode d’accès d’un dossier lié chez le fournisseur a changé.'
      )
      planifierVerificationAcces(organisationId)
      return prisma.dossierLie.findUniqueOrThrow({
        ...query,
        where: { id: dossier.id },
      })
    },
  }),

  appliquerPropositionAcces: t.field({
    type: EtatPropositionEnum,
    authScopes: { admin: true },
    description:
      'Applique une proposition chez le fournisseur. Rend APPLIQUEE, ou ECHEC avec son message dans la proposition.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const organisationId = ctx.organisation!.id
      const etat = await appliquerProposition(
        organisationId,
        String(id),
        ctx.personne!.id
      )
      if (etat === null) throw accesRefuse()
      planifierVerificationAcces(organisationId)
      return etat
    },
  }),

  appliquerPropositionsDossier: t.int({
    authScopes: { admin: true },
    description:
      'Applique les propositions en attente d’un dossier lié, cinquante au plus. Rend le nombre de propositions appliquées.',
    args: { dossierId: t.arg.id({ required: true }) },
    resolve: async (_root, { dossierId }, ctx) => {
      const organisationId = ctx.organisation!.id
      const propositions = await prisma.propositionAcces.findMany({
        where: {
          organisationId,
          dossierLieId: String(dossierId),
          etat: 'EN_ATTENTE',
        },
        orderBy: [{ creeLe: 'asc' }, { id: 'asc' }],
        take: 50,
        select: { id: true },
      })
      let appliquees = 0
      for (const p of propositions) {
        if (
          (await appliquerProposition(
            organisationId,
            p.id,
            ctx.personne!.id
          )) === 'APPLIQUEE'
        ) {
          appliquees += 1
        }
      }
      planifierVerificationAcces(organisationId)
      return appliquees
    },
  }),

  ecarterPropositionAcces: t.boolean({
    authScopes: { admin: true },
    description:
      'Écarte une proposition : rien ne change chez le fournisseur. Elle ne revient pas tant que la situation de la personne ne change pas.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      const { count } = await prisma.propositionAcces.updateMany({
        where: {
          id: String(id),
          organisationId: ctx.organisation!.id,
          etat: { in: ['EN_ATTENTE', 'ECHEC'] },
        },
        data: {
          etat: 'ECARTEE',
          traiteeParId: ctx.personne!.id,
          traiteeLe: new Date(),
        },
      })
      if (count === 0) throw accesRefuse()
      return true
    },
  }),

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

/**
 * Les groupes qui ont un droit sur le dossier chez le fournisseur et dont la
 * connexion gère les membres. Un groupe d'un site SharePoint, ou le groupe des
 * admins d'un Nextcloud, ne se gère pas.
 */
async function groupesGerables(
  organisationId: string,
  dossier: { emplacement: string; element: string; fournisseur: string }
): Promise<GroupeDuDossier[]> {
  try {
    const { espace } = await ouvrirEspace(organisationId)
    const annuaire = espace.annuaire
    if (
      annuaire === undefined ||
      espace.fournisseur !== dossier.fournisseur ||
      !annuaire.capacites.gestionDeGroupe
    ) {
      return []
    }
    const droits = await annuaire.droits({
      emplacement: dossier.emplacement,
      base: dossier.element,
      chemin: [],
    })
    const groupes = new Map<string, GroupeDuDossier>()
    for (const { beneficiaire: b } of droits ?? []) {
      if (
        b.type === 'groupe' &&
        (annuaire.groupeGerable?.(b.identifiant) ?? true)
      ) {
        groupes.set(b.identifiant, { identifiant: b.identifiant, nom: b.nom })
      }
    }
    return [...groupes.values()].sort((a, b) =>
      a.nom.localeCompare(b.nom, 'fr')
    )
  } catch (erreur) {
    throw erreurEspace(erreur)
  }
}
