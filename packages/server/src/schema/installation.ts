import { StatutOrganisation } from '@relaytour/database'

import { erreurSaisie } from '../lib/erreurs.ts'
import { journal } from '../lib/journal.ts'
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
      creeLe: t.expose('creeLe', { type: 'DateTime' }),
      nombreMembres: t.exposeInt('nombreMembres'),
      activites: t.field({
        type: [ActiviteInstallationRef],
        resolve: o => o.activites,
      }),
    }),
  })

async function uneOrganisation(slug: string) {
  const organisation = (await organisationsInstallation()).find(
    o => o.slug === slug
  )
  if (organisation === undefined) {
    throw erreurSaisie(`Aucune organisation ne porte le slug « ${slug} ».`)
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
    },
    resolve: async (_root, args) => {
      await creerOrganisation({
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
      'Donne le rôle d’admin d’une organisation à une adresse et lui envoie une invitation. La réponse ne renvoie aucune donnée du compte.',
    args: {
      organisation: t.arg.string({ required: true }),
      email: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      await inviterAdmin(args.organisation, args.email, args.nom)
      journal.info(
        { evenement: 'admin-invite', organisation: args.organisation },
        'Un admin a été invité par l’administration de l’installation.'
      )
      return true
    },
  }),

  modifierOrganisationInstallation: t.field({
    type: OrganisationInstallationRef,
    authScopes: { administration: true },
    args: {
      slug: t.arg.string({ required: true }),
      statut: t.arg({ type: StatutOrganisationEnum }),
      limites: t.arg({ type: LimitesInput }),
    },
    resolve: async (_root, args) => {
      await modifierOrganisation(args.slug, {
        statut: args.statut ?? undefined,
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
}))
