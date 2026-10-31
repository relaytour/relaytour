import { prisma, StatutOrganisation } from '@relaytour/database'

import { erreurSaisie } from '../lib/erreurs.ts'
import { journal } from '../lib/journal.ts'
import { i18n } from '../lib/langue.ts'
import type { Limites } from '../lib/limites.ts'
import {
  creerOrganisation,
  inviterAdmin,
  modifierOrganisation,
  organisationsInstallation,
  type ActiviteInstallation,
  type OrganisationInstallation,
  type PeriodeInstallation,
} from '../lib/installation.ts'
import {
  envoyerLienDExport,
  preparerExportPourAdmin,
} from '../lib/export-pour-admin.ts'
import { rappelerAdresses } from '../lib/rappel-adresses.ts'

import { ModuleActiviteEnum } from './activites.ts'
import { builder } from './builder.ts'

// Administration de l'installation (ADR 0008).
//
// Ces champs répondent au seul jeton JETON_ADMINISTRATION, jamais à une session.
// Ils servent le portail d'un hébergeur : créer, suspendre, limiter et exporter les
// organisations. Aucun type exposé ici ne porte de personne, de tâche ou de fiche.

const StatutOrganisationEnum = builder.enumType(StatutOrganisation, {
  name: 'StatutOrganisation',
  description:
    'ACTIVE : tout est permis. LECTURE_SEULE : les membres lisent, personne n’écrit. SUSPENDUE et ARCHIVEE : plus aucun accès.',
})

const LimitesRef = builder.objectRef<Limites>('LimitesOrganisation').implement({
  description:
    'Plafonds d’une organisation. Un champ nul signifie aucune limite. Une limite bloque une création, jamais la lecture ni l’export.',
  fields: t => ({
    activites: t.exposeInt('activites', { nullable: true }),
    periodesOuvertes: t.exposeInt('periodesOuvertes', { nullable: true }),
  }),
})

const LimitesInput = builder.inputType('LimitesOrganisationInput', {
  description:
    'Une valeur nulle retire la limite ; un champ absent la laisse telle quelle.',
  fields: t => ({
    activites: t.int(),
    periodesOuvertes: t.int(),
  }),
})

const PeriodeRef = builder
  .objectRef<PeriodeInstallation>('PeriodeInstallation')
  .implement({
    fields: t => ({
      annee: t.exposeInt('annee'),
      nom: t.exposeString('nom'),
      statut: t.exposeString('statut'),
      debut: t.expose('debut', { type: 'Date' }),
      fin: t.expose('fin', { type: 'Date' }),
    }),
  })

const ActiviteInstallationRef = builder
  .objectRef<ActiviteInstallation>('ActiviteInstallation')
  .implement({
    fields: t => ({
      slug: t.exposeString('slug'),
      nom: t.exposeString('nom'),
      nature: t.exposeString('nature'),
      archive: t.exposeBoolean('archive'),
      periodesOuvertes: t.field({
        type: [PeriodeRef],
        description: 'Périodes non archivées, celles que compte la limite.',
        resolve: a => a.periodesOuvertes,
      }),
    }),
  })

const OrganisationInstallationRef = builder
  .objectRef<OrganisationInstallation>('OrganisationInstallation')
  .implement({
    description:
      'Une organisation vue par l’administration de l’installation : identité, statut, limites et compteurs, sans aucune donnée de ses membres.',
    fields: t => ({
      slug: t.exposeString('slug'),
      nom: t.exposeString('nom'),
      statut: t.expose('statut', { type: StatutOrganisationEnum }),
      limites: t.field({ type: LimitesRef, resolve: o => o.limites }),
      modulesAutorises: t.field({
        type: [ModuleActiviteEnum],
        description:
          'Modules que les activités de l’organisation peuvent activer (ADR 0052).',
        resolve: o => o.modulesAutorises,
      }),
      creeLe: t.expose('creeLe', { type: 'DateTime' }),
      nombreMembres: t.exposeInt('nombreMembres'),
      activites: t.field({
        type: [ActiviteInstallationRef],
        resolve: o => o.activites,
      }),
    }),
  })

const ExportPourAdminRef = builder
  .objectRef<{ fichier: string; jeton: string }>('ExportPourAdmin')
  .implement({
    description:
      'Un export écrit dans EXPORTS_DIR pour un admin d’une installation en sommeil (ADR 0055), et le jeton de son lien de téléchargement.',
    fields: t => ({
      fichier: t.exposeString('fichier'),
      jeton: t.exposeString('jeton'),
    }),
  })

async function uneOrganisation(slug: string) {
  const organisation = (await organisationsInstallation()).find(
    o => o.slug === slug
  )
  if (organisation === undefined) {
    throw erreurSaisie(
      i18n._('Aucune organisation ne porte le slug « {slug} ».', { slug })
    )
  }
  return organisation
}

builder.queryFields(t => ({
  organisations: t.field({
    type: [OrganisationInstallationRef],
    authScopes: { administration: true },
    resolve: () => organisationsInstallation(),
  }),
}))

builder.mutationFields(t => ({
  creerOrganisation: t.field({
    type: OrganisationInstallationRef,
    authScopes: { administration: true },
    args: {
      slug: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
      sigle: t.arg.string(),
      fuseauHoraire: t.arg.string(),
      domainesCourrielAutorises: t.arg.stringList(),
      limites: t.arg({ type: LimitesInput }),
      // Absents, tous les modules sont autorisés (ADR 0052).
      modulesAutorises: t.arg({ type: [ModuleActiviteEnum] }),
    },
    resolve: async (_root, args) => {
      await creerOrganisation({
        modulesAutorises: args.modulesAutorises ?? undefined,
        slug: args.slug,
        nom: args.nom,
        sigle: args.sigle ?? undefined,
        fuseauHoraire: args.fuseauHoraire ?? undefined,
        domainesCourrielAutorises: args.domainesCourrielAutorises ?? undefined,
        limites: {
          ...(args.limites?.activites == null
            ? {}
            : { activites: args.limites.activites }),
          ...(args.limites?.periodesOuvertes == null
            ? {}
            : { periodesOuvertes: args.limites.periodesOuvertes }),
        },
      })
      journal.info(
        { evenement: 'organisation-creee', organisation: args.slug },
        'Une organisation a été créée par l’administration de l’installation.'
      )
      return uneOrganisation(args.slug)
    },
  }),

  inviterPremierAdmin: t.boolean({
    authScopes: { administration: true },
    description:
      'Donne le rôle d’admin d’une organisation à une adresse et lui envoie une invitation. Vrai quand l’admin est en place ; faux quand l’adresse a déjà un compte hors de l’organisation, dont l’invitation attend l’accord (ADR 0030). La réponse ne renvoie aucune donnée du compte.',
    args: {
      organisation: t.arg.string({ required: true }),
      email: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      const { enAttente } = await inviterAdmin(
        args.organisation,
        args.email,
        args.nom
      )
      journal.info(
        {
          evenement: 'admin-invite',
          organisation: args.organisation,
          enAttente,
        },
        'Un admin a été invité par l’administration de l’installation.'
      )
      return !enAttente
    },
  }),

  modifierOrganisationInstallation: t.field({
    type: OrganisationInstallationRef,
    authScopes: { administration: true },
    args: {
      slug: t.arg.string({ required: true }),
      statut: t.arg({ type: StatutOrganisationEnum }),
      limites: t.arg({ type: LimitesInput }),
      // Absents, les modules autorisés ne changent pas ; une liste vide les ferme
      // tous. `autoriserTousLesModules` revient à aucune restriction (ADR 0052).
      modulesAutorises: t.arg({ type: [ModuleActiviteEnum] }),
      autoriserTousLesModules: t.arg.boolean(),
    },
    resolve: async (_root, args) => {
      if (
        args.autoriserTousLesModules === true &&
        args.modulesAutorises !== null &&
        args.modulesAutorises !== undefined
      ) {
        throw erreurSaisie(
          i18n._(
            'Donnez soit la liste des modules autorisés, soit autoriserTousLesModules.'
          )
        )
      }
      await modifierOrganisation(args.slug, {
        statut: args.statut ?? undefined,
        modulesAutorises:
          args.autoriserTousLesModules === true
            ? null
            : (args.modulesAutorises ?? undefined),
        limites:
          args.limites === null || args.limites === undefined
            ? undefined
            : args.limites,
      })
      journal.info(
        {
          evenement: 'organisation-modifiee',
          organisation: args.slug,
          statut: args.statut ?? undefined,
          limites: args.limites ?? undefined,
          // La levée de la restriction se consigne aussi : `tous`.
          modulesAutorises:
            args.autoriserTousLesModules === true
              ? 'tous'
              : (args.modulesAutorises ?? undefined),
        },
        'Une organisation a été modifiée par l’administration de l’installation.'
      )
      return uneOrganisation(args.slug)
    },
  }),

  demanderExport: t.string({
    authScopes: { administration: true },
    description:
      'Écrit l’export complet d’une organisation dans le dossier EXPORTS_DIR du serveur et renvoie le nom du fichier. Le contenu ne transite jamais par l’API.',
    args: { organisation: t.arg.string({ required: true }) },
    resolve: async (_root, args) => {
      const [{ ecrireExport }, { env }, path] = await Promise.all([
        import('../lib/export.ts'),
        import('../env.ts'),
        import('node:path'),
      ])
      const { chemin, octets } = await ecrireExport(
        args.organisation,
        env.EXPORTS_DIR
      )
      journal.info(
        {
          evenement: 'export-ecrit',
          organisation: args.organisation,
          fichier: path.basename(chemin),
          octets,
        },
        'Un export d’organisation a été écrit.'
      )
      return path.basename(chemin)
    },
  }),

  rappelerAdresses: t.boolean({
    authScopes: { administration: true },
    description:
      'Envoie à une adresse le rappel de ses espaces dans cette installation, si elle appartient à un membre (ADR 0054). Répond toujours vrai : la réponse ne dit jamais si l’adresse est connue.',
    args: { courriel: t.arg.string({ required: true }) },
    resolve: async (_root, args) => {
      await rappelerAdresses(prisma, args.courriel)
      return true
    },
  }),

  preparerExportPourAdmin: t.field({
    type: ExportPourAdminRef,
    nullable: true,
    authScopes: { administration: true },
    description:
      'Écrit l’export complet d’une organisation pour l’admin qui porte cette adresse, et tire le jeton de son lien (ADR 0055). Nul quand l’adresse n’appartient à aucun admin actif, ou quand un lien est parti depuis moins de 24 heures. Sans adresse, prépare le dernier export pour tous les admins, sans limite.',
    args: {
      organisation: t.arg.string({ required: true }),
      courriel: t.arg.string(),
    },
    resolve: async (_root, args) => {
      const { env } = await import('../env.ts')
      return preparerExportPourAdmin(
        prisma,
        args.organisation,
        args.courriel,
        env.EXPORTS_DIR
      )
    },
  }),

  envoyerLienDExport: t.boolean({
    authScopes: { administration: true },
    description:
      'Envoie tout de suite, sans la file du worker, le lien de téléchargement d’un export préparé par preparerExportPourAdmin (ADR 0055). Le lien reste valable 7 jours.',
    args: {
      organisation: t.arg.string({ required: true }),
      jeton: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      await envoyerLienDExport(prisma, args.organisation, args.jeton)
      return true
    },
  }),
}))
