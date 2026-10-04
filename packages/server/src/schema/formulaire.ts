import { prisma, type Prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { lireGroupes } from '../lib/activites.ts'
import type { AdressesDeRole } from '../lib/contenu.ts'
import { signalerDemande } from '../lib/demandes.ts'
import { erreurSaisie } from '../lib/erreurs.ts'
import {
  contientUnLien,
  descriptionPubliable,
  lireFormulaire,
  type Formulaire,
} from '../lib/formulaire.ts'
import { journal } from '../lib/journal.ts'
import { limiterParCle } from '../lib/limite.ts'
import { configurationActivite } from '../lib/organisation.ts'
import { adresseValide, texteRequis } from '../lib/saisie.ts'
import { identifiantsSouhaites } from '../lib/souhaits.ts'

import { builder } from './builder.ts'

// Formulaire public pour rejoindre l'équipe d'une activité (ADR 0015). Ces deux
// opérations se lisent sans session : elles ne servent que des champs publics, et le
// dépôt vérifie lui-même que l'organisation est active et que le formulaire est
// ouvert. Aucun type ne porte d'identifiant de la base.

// Limites d'un dépôt. Le compteur Valkey borne une adresse IP et une adresse mail ;
// la base borne l'activité entière, même si Valkey ne répond pas.
const DEPOTS_PAR_IP_ET_PAR_HEURE = 5
const DEPOTS_PAR_ADRESSE_ET_PAR_JOUR = 2
const DEPOTS_PAR_ACTIVITE_ET_PAR_HEURE = 60
const DEMANDES_EN_ATTENTE_MAX = 300

const REPONSE_MAX = 120
const TEXTE_MAX = 600

const FERME = 'Ce formulaire n’est pas ouvert.'
const TROP = 'Trop de demandes ont été envoyées. Réessayez plus tard.'

interface PerimetreDuFormulaire {
  slug: string
  nom: string
  description: string | null
  couleur: string | null
}

interface FormulaireOuvert {
  organisationId: string
  activiteId: string
  editionId: string
  organisation: string
  activite: string
  periode: string
  formulaire: Formulaire
  contact: string
  groupes: { libelle: string; perimetres: PerimetreDuFormulaire[] }[]
  /** Identifiant de chaque périmètre proposé, par slug. */
  perimetres: Map<string, string>
}

/**
 * Le formulaire d'une activité, s'il est ouvert : l'organisation est active,
 * l'activité n'est pas archivée, un admin a ouvert le formulaire, une période n'est
 * pas archivée (en préparation ou en cours) et un contact est déclaré. Sinon null, sans dire pourquoi. Sans slug
 * d'organisation, l'installation doit n'en porter qu'une.
 */
async function formulaireOuvert(
  slugOrganisation: string | null | undefined,
  slugActivite: string
): Promise<FormulaireOuvert | null> {
  const organisation = slugOrganisation
    ? await prisma.organisation.findFirst({
        where: { slug: slugOrganisation, statut: 'ACTIVE' },
        select: { id: true },
      })
    : (await prisma.organisation.count()) === 1
      ? await prisma.organisation.findFirst({
          where: { statut: 'ACTIVE' },
          select: { id: true },
        })
      : null
  if (organisation === null) return null
  const activite = await prisma.activite.findFirst({
    where: {
      organisationId: organisation.id,
      slug: slugActivite,
      archivedAt: null,
      formulaireOuvert: true,
    },
    select: { id: true, nom: true, groupes: true, formulaire: true },
  })
  if (activite === null) return null
  const [edition, configuration, perimetres] = await Promise.all([
    // La même période que l'espace organisateur propose par défaut.
    prisma.edition.findFirst({
      where: { activiteId: activite.id, statut: { not: 'ARCHIVEE' } },
      orderBy: { annee: 'desc' },
      select: { id: true, nom: true },
    }),
    configurationActivite(activite.id),
    prisma.perimetre.findMany({
      where: { activiteId: activite.id, archivedAt: null },
      orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      select: {
        id: true,
        slug: true,
        nom: true,
        description: true,
        couleur: true,
        groupe: true,
      },
    }),
  ])
  if (edition === null || configuration.contactRecrutement === undefined) {
    return null
  }
  const role: AdressesDeRole = {
    domaines: configuration.domainesCourrielAutorises,
    adresses: configuration.adressesRoleAutorisees,
  }
  return {
    organisationId: organisation.id,
    activiteId: activite.id,
    editionId: edition.id,
    organisation: configuration.nomCourt,
    activite: activite.nom,
    periode: edition.nom,
    formulaire: lireFormulaire(activite.formulaire),
    contact: configuration.contactRecrutement,
    groupes: lireGroupes(activite.groupes)
      .map(groupe => ({
        libelle: groupe.libellePluriel,
        perimetres: perimetres
          .filter(p => p.groupe === groupe.cle)
          .map(p => ({
            slug: p.slug,
            nom: p.nom,
            description: descriptionPubliable(p.description, role),
            couleur: p.couleur,
          })),
      }))
      .filter(groupe => groupe.perimetres.length > 0),
    perimetres: new Map(perimetres.map(p => [p.slug, p.id])),
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

const PerimetreDuFormulaireRef = builder
  .objectRef<PerimetreDuFormulaire>('PerimetreDuFormulaire')
  .implement({
    fields: t => ({
      slug: t.exposeString('slug'),
      nom: t.exposeString('nom'),
      description: t.exposeString('description', {
        nullable: true,
        description:
          'Vaut null sans description, ou si elle contient une coordonnée personnelle.',
      }),
      couleur: t.exposeString('couleur', { nullable: true }),
    }),
  })

const GroupeDuFormulaireRef = builder
  .objectRef<FormulaireOuvert['groupes'][number]>('GroupeDuFormulaire')
  .implement({
    fields: t => ({
      libelle: t.exposeString('libelle'),
      perimetres: t.field({
        type: [PerimetreDuFormulaireRef],
        resolve: g => g.perimetres,
      }),
    }),
  })

const FormulaireRejoindreRef = builder
  .objectRef<FormulaireOuvert>('FormulaireRejoindre')
  .implement({
    description:
      'Formulaire public pour rejoindre l’équipe d’une activité (ADR 0015). Lisible sans session.',
    fields: t => ({
      organisation: t.exposeString('organisation'),
      activite: t.exposeString('activite'),
      periode: t.exposeString('periode'),
      introduction: t.string({
        nullable: true,
        resolve: f => f.formulaire.introduction ?? null,
      }),
      question: t.string({
        nullable: true,
        description:
          'Libellé de la question complémentaire propre à l’organisation.',
        resolve: f => f.formulaire.question ?? null,
      }),
      paliers: t.stringList({
        description: 'Paliers de disponibilité proposés.',
        resolve: f => f.formulaire.paliers ?? [],
      }),
      groupes: t.field({
        type: [GroupeDuFormulaireRef],
        resolve: f => f.groupes,
      }),
      contact: t.exposeString('contact', {
        description:
          'Adresse de rôle à laquelle demander l’accès à ses données ou leur suppression.',
      }),
    }),
  })

// ── Lecture ──────────────────────────────────────────────────────────────────

builder.queryField('formulaireRejoindre', t =>
  t.field({
    type: FormulaireRejoindreRef,
    nullable: true,
    description:
      'Le formulaire d’une activité, ou null s’il est fermé. Sans slug d’organisation : l’unique organisation de l’installation. Lisible sans session.',
    args: {
      organisation: t.arg.string(),
      activite: t.arg.string({ required: true }),
    },
    resolve: (_root, args) =>
      formulaireOuvert(args.organisation, args.activite),
  })
)

// ── Dépôt ────────────────────────────────────────────────────────────────────

/** Un texte libre du formulaire : rogné, borné, sans lien. Vide, il vaut null. */
function texteLibre(
  brut: string | null | undefined,
  nom: string,
  max: number
): string | null {
  const texte = (brut ?? '').trim()
  if (texte === '') return null
  if (texte.length > max) {
    throw erreurSaisie(`${nom} compte ${max} caractères au plus.`)
  }
  if (contientUnLien(texte)) {
    throw erreurSaisie('Les liens ne sont pas acceptés dans ce formulaire.')
  }
  return texte
}

/** Refuse le dépôt quand l'adresse IP ou l'adresse mail en envoient trop. */
async function exigerDebitRaisonnable(
  ctx: AppContext,
  formulaire: FormulaireOuvert,
  email: string
) {
  const refuser = { siIndisponible: 'refuser' } as const
  const parIp = await limiterParCle(
    `rejoindre-ip-${ctx.ip ?? 'inconnue'}`,
    DEPOTS_PAR_IP_ET_PAR_HEURE,
    3600,
    refuser
  )
  const parAdresse = await limiterParCle(
    `rejoindre-adresse-${formulaire.activiteId}-${email}`,
    DEPOTS_PAR_ADRESSE_ET_PAR_JOUR,
    86_400,
    refuser
  )
  if (!parIp || !parAdresse) throw erreurSaisie(TROP)
}

/**
 * Refuse le dépôt quand l'activité en a trop reçu. L'appelant tient le verrou de
 * l'activité : le comptage et la création qui suit ne se croisent pas avec un autre
 * dépôt, et les plafonds ne se dépassent pas.
 */
async function exigerPlaceDansLActivite(
  tx: Prisma.TransactionClient,
  activiteId: string
) {
  const duFormulaire = { activiteId, origine: 'FORMULAIRE' as const }
  const [recentes, enAttente] = await Promise.all([
    tx.demande.count({
      where: {
        ...duFormulaire,
        createdAt: { gte: new Date(Date.now() - 3600 * 1000) },
      },
    }),
    tx.demande.count({ where: { ...duFormulaire, statut: 'EN_ATTENTE' } }),
  ])
  if (
    recentes >= DEPOTS_PAR_ACTIVITE_ET_PAR_HEURE ||
    enAttente >= DEMANDES_EN_ATTENTE_MAX
  ) {
    throw erreurSaisie(TROP)
  }
}

builder.mutationField('envoyerDemande', t =>
  t.boolean({
    description:
      'Dépose une demande pour rejoindre l’équipe d’une activité dont le formulaire est ouvert. La réponse est la même que l’adresse ait déjà un compte, une demande en attente, ou ni l’un ni l’autre. Utilisable sans session.',
    args: {
      organisation: t.arg.string(),
      activite: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
      email: t.arg.string({ required: true }),
      perimetres: t.arg.stringList({ required: true }),
      disponibilite: t.arg.string(),
      reponse: t.arg.string(),
      texte: t.arg.string(),
      // Champ piège : un robot le remplit, une personne ne le voit pas.
      siteWeb: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      // Le type Mutation n'exige que « ecriture », vrai sans organisation active :
      // l'ouverture se vérifie ici, sur l'organisation et l'activité visées.
      const formulaire = await formulaireOuvert(
        args.organisation,
        args.activite
      )
      if (formulaire === null) throw erreurSaisie(FERME)
      // Un dépôt piégé reçoit la même réponse qu'un dépôt accepté, sans écriture.
      if ((args.siteWeb ?? '').trim() !== '') return true

      const email = adresseValide(args.email)
      const nom = texteRequis(args.nom, 'Le nom', 120)
      if (contientUnLien(nom)) {
        throw erreurSaisie('Les liens ne sont pas acceptés dans ce formulaire.')
      }
      const slugs = identifiantsSouhaites(args.perimetres)
      const perimetreIds = slugs.map(slug => formulaire.perimetres.get(slug))
      if (perimetreIds.some(id => id === undefined)) {
        throw erreurSaisie('Un périmètre choisi est introuvable.')
      }
      const paliers = formulaire.formulaire.paliers ?? []
      const disponibilite = (args.disponibilite ?? '').trim() || null
      if (disponibilite !== null && !paliers.includes(disponibilite)) {
        throw erreurSaisie('Choisissez une disponibilité dans la liste.')
      }
      const reponse = texteLibre(args.reponse, 'La réponse', REPONSE_MAX)
      const texte = texteLibre(args.texte, 'Le texte', TEXTE_MAX)

      await exigerDebitRaisonnable(ctx, formulaire, email)

      try {
        await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM Activite WHERE id = ${formulaire.activiteId} FOR UPDATE`
          await exigerPlaceDansLActivite(tx, formulaire.activiteId)
          await tx.demande.create({
            data: {
              organisationId: formulaire.organisationId,
              activiteId: formulaire.activiteId,
              editionId: formulaire.editionId,
              origine: 'FORMULAIRE',
              nom,
              adresse: email,
              adresseEnAttente: email,
              disponibilite,
              // La question se garde avec sa réponse : le réglage peut changer.
              question:
                reponse === null
                  ? null
                  : (formulaire.formulaire.question ?? null),
              reponse,
              texte,
              perimetres: {
                create: perimetreIds.map(perimetreId => ({
                  perimetreId: perimetreId!,
                })),
              },
            },
          })
        })
      } catch (erreur) {
        // P2002 : une demande attend déjà pour cette adresse et cette période. La
        // première reste telle quelle, et la réponse ne le dit pas.
        if ((erreur as { code?: string }).code !== 'P2002') throw erreur
        return true
      }
      journal.info(
        {
          evenement: 'demande-deposee',
          activiteId: formulaire.activiteId,
          perimetres: perimetreIds.length,
        },
        'Une demande a été déposée par le formulaire public.'
      )
      await signalerDemande(prisma, {
        organisationId: formulaire.organisationId,
        activiteId: formulaire.activiteId,
      })
      return true
    },
  })
)
