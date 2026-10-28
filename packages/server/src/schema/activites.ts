import {
  AdressesOrganigramme,
  NatureActivite,
  Prisma,
  prisma,
} from '@relaytour/database'

import {
  groupesParDefaut,
  groupesValides,
  lireGroupes,
  slugActiviteValide,
  type GroupePerimetres,
} from '../lib/activites.ts'
import { donneesPersonnelles } from '../lib/contenu.ts'
import { accesRefuse, erreurSaisie } from '../lib/erreurs.ts'
import {
  FormulaireSchema,
  formulaireVide,
  lireFormulaire,
  textesDuFormulaire,
  type Formulaire,
} from '../lib/formulaire.ts'
import { exigerPlaceActivite, sousVerrouOrganisation } from '../lib/limites.ts'
import {
  lireModules,
  MODULES,
  modulesActifs,
  modulesValides,
} from '../lib/modules.ts'
import { lirePhases, phasesValides, type Phase } from '../lib/phases.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { i18n } from '../lib/langue.ts'
import { configurationActivite } from '../lib/organisation.ts'
import { sansDoublon, texteRequis } from '../lib/saisie.ts'
import { marquerContenuModifie } from '../lib/synchronisation.ts'

import { builder } from './builder.ts'

// Activités d'une organisation (ADR 0008) : un événement, une section, une instance.
// Une personne ne lit que les activités qu'elle voit (ADR 0010) : celles qu'elle
// administre et celles où elle a été affectée. Un admin de l'organisation crée et
// archive les activités ; l'admin d'une activité la modifie.

export const NatureActiviteEnum = builder.enumType(NatureActivite, {
  name: 'NatureActivite',
  description:
    'Fixe le libellé de la période : édition pour un événement, saison pour une section, mandat pour une instance.',
})

const GroupePerimetresRef = builder
  .objectRef<GroupePerimetres>('GroupePerimetres')
  .implement({
    description: 'Catégorie de périmètres déclarée par une activité.',
    fields: t => ({
      cle: t.exposeString('cle'),
      libelle: t.exposeString('libelle'),
      libellePluriel: t.exposeString('libellePluriel'),
    }),
  })

const GroupePerimetresInput = builder.inputType('GroupePerimetresInput', {
  fields: t => ({
    cle: t.string({ required: true }),
    libelle: t.string({ required: true }),
    libellePluriel: t.string({ required: true }),
  }),
})

// Phase d'une activité (ADR 0025) : une tâche s'y range par son échéance.
const PhaseRef = builder.objectRef<Phase>('Phase').implement({
  description:
    'Phase d’une activité. Une tâche se range dans la première phase dont la borne n’est pas dépassée.',
  fields: t => ({
    cle: t.exposeString('cle'),
    libelle: t.exposeString('libelle'),
    jusquA: t.exposeString('jusquA', {
      nullable: true,
      description:
        'Dernier jour de la phase, en jours depuis le premier jour de la période : J-120, J+30. La dernière phase n’en porte pas.',
    }),
  }),
})

const PhaseInput = builder.inputType('PhaseInput', {
  fields: t => ({
    cle: t.string({ required: true }),
    libelle: t.string({ required: true }),
    jusquA: t.string(),
  }),
})

// Réglage du formulaire public pour rejoindre l'équipe (ADR 0015).
const FormulaireRef = builder.objectRef<Formulaire>('Formulaire').implement({
  description:
    'Réglage du formulaire public d’une activité : introduction, question complémentaire et paliers de disponibilité.',
  fields: t => ({
    introduction: t.exposeString('introduction', { nullable: true }),
    question: t.exposeString('question', { nullable: true }),
    paliers: t.stringList({ resolve: f => f.paliers ?? [] }),
  }),
})

const FormulaireInput = builder.inputType('FormulaireInput', {
  fields: t => ({
    introduction: t.string(),
    question: t.string(),
    paliers: t.stringList(),
  }),
})

// Accès d'une personne à une activité (ADR 0012). COMPLET : elle l'administre ou y
// a été affectée, et lit ses tâches et ses fiches. DECOUVERTE : elle ne voit que la
// page « Tous les périmètres » et formule ses souhaits.
export const AdressesOrganigrammeEnum = builder.enumType(AdressesOrganigramme, {
  name: 'AdressesOrganigramme',
  description:
    'Adresses personnelles que l’organigramme d’une activité peut afficher, avec l’accord de chaque personne (ADR 0036).',
})

export const ModuleActiviteEnum = builder.enumType('ModuleActivite', {
  values: MODULES,
  description:
    'Écran facultatif d’une activité, avec ses données et ses envois (ADR 0052).',
})

const AccesActiviteEnum = builder.enumType('AccesActivite', {
  values: ['COMPLET', 'DECOUVERTE'] as const,
})

export const ActiviteRef = builder.prismaObject('Activite', {
  fields: t => ({
    id: t.exposeID('id'),
    slug: t.exposeString('slug'),
    nom: t.exposeString('nom'),
    sigle: t.exposeString('sigle', { nullable: true }),
    nature: t.expose('nature', { type: NatureActiviteEnum }),
    groupes: t.field({
      type: [GroupePerimetresRef],
      resolve: a => lireGroupes(a.groupes),
    }),
    phases: t.field({
      type: [PhaseRef],
      description:
        'Les phases de l’activité, dans l’ordre : celles qu’elle déclare, sinon les phases par défaut (ADR 0025).',
      resolve: a => lirePhases(a.phases),
    }),
    ordre: t.exposeInt('ordre'),
    archive: t.boolean({ resolve: a => a.archivedAt !== null }),
    // Vrai quand la personne connectée administre l'activité (ADR 0010).
    estAdministree: t.boolean({
      resolve: (a, _args, ctx) => ctx.estAdminDe(a.id),
    }),
    souhaitsOuverts: t.exposeBoolean('souhaitsOuverts', {
      description:
        'Vrai quand les personnes de l’équipe de l’activité formulent elles-mêmes leurs souhaits (ADR 0045). Le réglage ne rend l’activité visible à personne.',
    }),
    formulaire: t.field({
      type: FormulaireRef,
      resolve: a => lireFormulaire(a.formulaire),
    }),
    formulaireOuvert: t.exposeBoolean('formulaireOuvert', {
      description:
        'Vrai quand le formulaire public de l’activité accepte des demandes (ADR 0015).',
    }),
    adressesOrganigramme: t.expose('adressesOrganigramme', {
      type: AdressesOrganigrammeEnum,
    }),
    modules: t.field({
      type: [ModuleActiviteEnum],
      description:
        'Les modules actifs : ceux que l’activité active et que l’hébergeur autorise (ADR 0052).',
      select: {
        modules: true,
        organisation: { select: { modulesAutorises: true } },
      },
      resolve: a => modulesActifs(a, a.organisation),
    }),
    modulesAutorises: t.field({
      type: [ModuleActiviteEnum],
      description:
        'Les modules que l’administration de l’installation autorise pour l’organisation (ADR 0052).',
      select: { organisation: { select: { modulesAutorises: true } } },
      resolve: a => lireModules(a.organisation.modulesAutorises),
    }),
    acces: t.field({
      type: AccesActiviteEnum,
      resolve: async (a, _args, ctx) =>
        (await ctx.activitesVisibles()).has(a.id) ? 'COMPLET' : 'DECOUVERTE',
    }),
  }),
})

// La période et le périmètre disent à quelle activité ils appartiennent.
builder.prismaObjectFields('Edition', t => ({
  activite: t.relation('activite', { type: ActiviteRef }),
}))
builder.prismaObjectFields('Perimetre', t => ({
  activite: t.relation('activite', { type: ActiviteRef }),
  groupe: t.exposeString('groupe'),
}))
builder.prismaObjectFields('Fiche', t => ({
  activite: t.relation('activite', { type: ActiviteRef }),
}))

builder.queryFields(t => ({
  activites: t.prismaField({
    type: [ActiviteRef],
    authScopes: { connecte: true },
    args: { inclureArchives: t.arg.boolean({ defaultValue: false }) },
    resolve: async (query, _root, { inclureArchives }, ctx) =>
      prisma.activite.findMany({
        ...query,
        where: {
          organisationId: ctx.organisation!.id,
          // Les activités découvertes : `acces` dit si la personne lit aussi leurs
          // tâches et leurs fiches (ADR 0012).
          id: { in: [...(await ctx.activitesDecouvertes())] },
          ...(inclureArchives ? {} : { archivedAt: null }),
        },
        orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      }),
  }),
}))

/**
 * Les colonnes du formulaire public à écrire, d'après les arguments reçus. Le réglage
 * est un contenu : il se valide comme à l'import, sans coordonnée personnelle. Le
 * formulaire ne s'ouvre pas sans contact, que sa mention cite pour l'accès aux
 * données et leur suppression.
 */
async function reglageDuFormulaire(
  activiteId: string,
  args: {
    formulaire?: {
      introduction?: string | null
      question?: string | null
      paliers?: string[] | null
    } | null
    formulaireOuvert?: boolean | null
  }
): Promise<Prisma.ActiviteUpdateInput> {
  const donnees: Prisma.ActiviteUpdateInput = {}
  const ouvrir = args.formulaireOuvert === true
  if (args.formulaire || ouvrir) {
    const configuration = await configurationActivite(activiteId)
    if (args.formulaire) {
      const vide = (texte: string | null | undefined) =>
        texte === null || texte === undefined || texte.trim() === ''
      const lu = FormulaireSchema.safeParse({
        introduction: vide(args.formulaire.introduction)
          ? undefined
          : args.formulaire.introduction,
        question: vide(args.formulaire.question)
          ? undefined
          : args.formulaire.question,
        paliers: (args.formulaire.paliers ?? []).filter(p => !vide(p)),
      })
      if (!lu.success) {
        throw erreurSaisie(
          i18n._(
            'Le formulaire accepte une introduction de 600 caractères, une question de 120 caractères et 8 paliers de 80 caractères au plus.'
          )
        )
      }
      const role = {
        domaines: configuration.domainesCourrielAutorises,
        adresses: configuration.adressesRoleAutorisees,
      }
      if (
        textesDuFormulaire(lu.data).some(
          texte => donneesPersonnelles(texte, role).length > 0
        )
      ) {
        throw erreurSaisie(
          i18n._(
            'Le formulaire est public : n’y écrivez ni adresse personnelle ni numéro de téléphone.'
          )
        )
      }
      donnees.formulaire = formulaireVide(lu.data) ? Prisma.DbNull : lu.data
    }
    if (ouvrir && configuration.contactRecrutement === undefined) {
      throw erreurSaisie(
        i18n._(
          'Renseignez d’abord le contact de l’activité ou de l’organisation : le formulaire le cite pour l’accès aux données et leur suppression.'
        )
      )
    }
  }
  if (args.formulaireOuvert !== null && args.formulaireOuvert !== undefined) {
    donnees.formulaireOuvert = args.formulaireOuvert
  }
  return donnees
}

/**
 * Les modules à écrire quand un admin règle ceux d'une activité. Il ne peut
 * activer qu'un module que l'hébergeur autorise. Un module déjà actif mais retiré
 * par l'hébergeur reste dans la liste : il revient si l'hébergeur l'autorise de
 * nouveau (ADR 0052).
 */
async function modulesDeLActivite(
  activiteId: string,
  demandes: readonly string[]
): Promise<string[]> {
  const modules = modulesValides(demandes)
  const activite = await prisma.activite.findUniqueOrThrow({
    where: { id: activiteId },
    select: {
      modules: true,
      organisation: { select: { modulesAutorises: true } },
    },
  })
  const autorises = lireModules(activite.organisation.modulesAutorises)
  if (modules.some(m => !autorises.includes(m))) {
    throw erreurSaisie(
      i18n._(
        'Votre hébergeur n’autorise pas ce module pour votre organisation.'
      )
    )
  }
  const gardes = lireModules(activite.modules).filter(
    m => !autorises.includes(m)
  )
  return MODULES.filter(m => modules.includes(m) || gardes.includes(m))
}

builder.mutationFields(t => ({
  creerActivite: t.prismaField({
    type: ActiviteRef,
    authScopes: { admin: true },
    args: {
      slug: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
      sigle: t.arg.string(),
      nature: t.arg({ type: NatureActiviteEnum, required: true }),
      groupes: t.arg({ type: [GroupePerimetresInput] }),
      // Absentes, l'activité garde les phases par défaut (ADR 0025).
      phases: t.arg({ type: [PhaseInput] }),
      ordre: t.arg.int({ defaultValue: 0 }),
    },
    resolve: async (query, _root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const donnees = {
        organisationId,
        slug: slugActiviteValide(args.slug),
        nom: texteRequis(args.nom, i18n._('Le nom')),
        sigle: args.sigle?.trim()
          ? texteRequis(args.sigle, i18n._('Le sigle'), 20)
          : null,
        nature: args.nature,
        groupes: groupesValides(args.groupes ?? groupesParDefaut()),
        ...(args.phases === null || args.phases === undefined
          ? {}
          : { phases: phasesValides(args.phases) }),
        ordre: args.ordre ?? 0,
        // Une activité nouvelle démarre sans module (ADR 0052).
        modules: [],
      }
      return sousVerrouOrganisation(organisationId, async tx => {
        await exigerPlaceActivite(organisationId, tx)
        const activite = await sansDoublon(
          tx.activite.create({ ...query, data: donnees }),
          i18n._('Une activité utilise déjà cet identifiant.')
        )
        await marquerContenuModifie(organisationId, tx)
        return activite
      })
    },
  }),

  modifierActivite: t.prismaField({
    type: ActiviteRef,
    authScopes: { gestion: true },
    args: {
      id: t.arg.id({ required: true }),
      nom: t.arg.string({ required: true }),
      sigle: t.arg.string(),
      nature: t.arg({ type: NatureActiviteEnum, required: true }),
      groupes: t.arg({ type: [GroupePerimetresInput], required: true }),
      // Absentes, les phases ne changent pas (ADR 0025).
      phases: t.arg({ type: [PhaseInput] }),
      ordre: t.arg.int({ required: true }),
      // Archiver ou rouvrir dans la même transaction : une limite atteinte ou la
      // dernière activité ouverte annulent toute la modification.
      archive: t.arg.boolean(),
      // Absent, le réglage ne change pas (ADR 0012).
      souhaitsOuverts: t.arg.boolean(),
      // Absents, le réglage et l'ouverture du formulaire public ne changent pas
      // (ADR 0015).
      formulaire: t.arg({ type: FormulaireInput }),
      formulaireOuvert: t.arg.boolean(),
      // Absent, le réglage ne change pas (ADR 0036).
      adressesOrganigramme: t.arg({ type: AdressesOrganigrammeEnum }),
      // Absents, les modules ne changent pas (ADR 0052).
      modules: t.arg({ type: [ModuleActiviteEnum] }),
    },
    resolve: async (query, _root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const id = await ctx.exigerActivite(args.id)
      await ctx.exigerAdminDe(id)
      const modules =
        args.modules === null || args.modules === undefined
          ? undefined
          : await modulesDeLActivite(id, args.modules)
      const formulaire = await reglageDuFormulaire(id, args)
      // Archiver ou rouvrir une activité touche aux limites de l'organisation :
      // seul un admin de l'organisation le fait.
      if (
        args.archive !== null &&
        args.archive !== undefined &&
        !ctx.personne!.estAdmin
      ) {
        throw accesRefuse()
      }
      const groupes = groupesValides(args.groupes)
      // Un groupe encore porté par un périmètre ne disparaît pas.
      const utilises = await prisma.perimetre.findMany({
        where: { activiteId: id },
        select: { groupe: true },
        distinct: ['groupe'],
      })
      const cles = new Set(groupes.map(g => g.cle))
      const manquant = utilises.find(p => !cles.has(p.groupe))
      if (manquant !== undefined) {
        throw erreurGroupeUtilise(manquant.groupe)
      }
      const donnees = {
        nom: texteRequis(args.nom, i18n._('Le nom')),
        sigle: args.sigle?.trim()
          ? texteRequis(args.sigle, i18n._('Le sigle'), 20)
          : null,
        nature: args.nature,
        groupes,
        ...(args.phases === null || args.phases === undefined
          ? {}
          : { phases: phasesValides(args.phases) }),
        ordre: args.ordre,
        ...(args.souhaitsOuverts === null || args.souhaitsOuverts === undefined
          ? {}
          : { souhaitsOuverts: args.souhaitsOuverts }),
        ...(args.adressesOrganigramme === null ||
        args.adressesOrganigramme === undefined
          ? {}
          : { adressesOrganigramme: args.adressesOrganigramme }),
        ...(modules === undefined ? {} : { modules }),
        ...formulaire,
      }
      const avant = await prisma.activite.findUniqueOrThrow({
        where: { id },
        select: { adressesOrganigramme: true },
      })
      const activite = await sousVerrouOrganisation(
        organisationId,
        async tx => {
          const archivedAt =
            args.archive === null || args.archive === undefined
              ? undefined
              : await archivage(tx, organisationId, id, args.archive)
          const activite = await tx.activite.update({
            ...query,
            where: { id },
            data: {
              ...donnees,
              ...(archivedAt === undefined ? {} : { archivedAt }),
            },
          })
          // Un groupe retiré n'a plus de périmètre : il quitte aussi les listes
          // « Concerne aussi » des fiches de l'activité (ADR 0039).
          await tx.ficheGroupeConnexe.deleteMany({
            where: {
              fiche: { activiteId: id },
              groupe: { notIn: groupes.map(g => g.cle) },
            },
          })
          await marquerContenuModifie(organisationId, tx)
          return activite
        }
      )
      // Les organigrammes ouverts relisent leurs adresses (ADR 0036), après la
      // validation de la transaction.
      if (
        donnees.adressesOrganigramme !== undefined &&
        donnees.adressesOrganigramme !== avant.adressesOrganigramme
      ) {
        publierPourActivite('EQUIPE', organisationId, id)
      }
      return activite
    },
  }),

  // Archiver une activité la retire des listes et libère sa place dans les limites.
  // Ses périodes, périmètres et fiches restent consultables.
  archiverActivite: t.prismaField({
    type: ActiviteRef,
    authScopes: { admin: true },
    args: {
      id: t.arg.id({ required: true }),
      archive: t.arg.boolean({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const organisationId = ctx.organisation!.id
      const id = await ctx.exigerActivite(args.id)
      return sousVerrouOrganisation(organisationId, async tx => {
        const archivedAt = await archivage(tx, organisationId, id, args.archive)
        const activite = await tx.activite.update({
          ...query,
          where: { id },
          data: { archivedAt },
        })
        await marquerContenuModifie(organisationId, tx)
        return activite
      })
    },
  }),
}))

/**
 * La date d'archivage d'une activité après la demande, contrôles faits sous le
 * verrou de l'organisation : rouvrir respecte la limite d'activités, archiver
 * garde au moins une activité ouverte. La date d'archivage d'origine est conservée.
 */
async function archivage(
  tx: Prisma.TransactionClient,
  organisationId: string,
  id: string,
  archive: boolean
): Promise<Date | null> {
  const actuelle = await tx.activite.findUniqueOrThrow({
    where: { id },
    select: { archivedAt: true },
  })
  if (!archive && actuelle.archivedAt !== null) {
    await exigerPlaceActivite(organisationId, tx)
  }
  if (archive && actuelle.archivedAt === null) {
    const restantes = await tx.activite.count({
      where: { organisationId, archivedAt: null, id: { not: id } },
    })
    if (restantes === 0) throw erreurDerniereActivite()
  }
  return archive ? (actuelle.archivedAt ?? new Date()) : null
}

function erreurGroupeUtilise(cle: string) {
  return erreurSaisie(
    i18n._(
      'Des périmètres appartiennent encore au groupe « {cle} » : changez-les de groupe avant de le retirer.',
      { cle }
    )
  )
}

function erreurDerniereActivite() {
  return erreurSaisie(
    i18n._('Une organisation garde au moins une activité ouverte.')
  )
}
