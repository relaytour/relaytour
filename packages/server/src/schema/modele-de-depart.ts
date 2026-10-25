import { prisma, type Prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { erreurSaisie } from '../lib/erreurs.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { i18n, langueCourante } from '../lib/langue.ts'
import { sousVerrouOrganisation } from '../lib/limites.ts'
import {
  appliquerModeleDeDepart,
  lireModeleDeDepart,
  MODELES_DE_DEPART,
  type ModeleDeDepart,
  type RapportModeleDeDepart,
} from '../orga/modele-de-depart.ts'

import { builder } from './builder.ts'

// Modèle de départ appliqué à une activité sans périmètre (ADR 0048). La
// simulation décrit le modèle et ce qu'il créerait ; l'application l'écrit. Le
// modèle se lit dans la langue de la requête.

const ModeleDeDepartEnum = builder.enumType('ModeleDeDepart', {
  values: MODELES_DE_DEPART,
})

interface ApercuPerimetre {
  slug: string
  nom: string
  groupe: string
  tachesTypes: number
}

interface ResultatModele extends RapportModeleDeDepart {
  apercu: ApercuPerimetre[]
  titresFiches: string[]
  /** Le titre de chaque fiche du modèle, par slug. */
  titres: Map<string, string>
}

const ApercuPerimetreRef = builder
  .objectRef<ApercuPerimetre>('ApercuPerimetreModele')
  .implement({
    fields: t => ({
      slug: t.exposeString('slug'),
      nom: t.exposeString('nom'),
      groupe: t.exposeString('groupe'),
      tachesTypes: t.exposeInt('tachesTypes'),
    }),
  })

const RapportModeleRef = builder
  .objectRef<ResultatModele>('RapportModeleDeDepart')
  .implement({
    description:
      'Ce qu’un modèle de départ apporte à une activité, ou apporterait en simulation.',
    fields: t => ({
      perimetres: t.field({
        type: [ApercuPerimetreRef],
        resolve: r => r.apercu,
      }),
      fiches: t.exposeStringList('titresFiches'),
      groupesAjoutes: t.exposeStringList('groupesAjoutes'),
      fichesEnConflit: t.stringList({
        description:
          'Les titres des fiches du modèle qui existent déjà dans l’organisation : elles ne sont pas reprises.',
        resolve: r => r.fiches.conflits.map(slug => r.titres.get(slug) ?? slug),
      }),
      periode: t.exposeString('periode', { nullable: true }),
      tachesCreees: t.stringList({ resolve: r => r.taches.creees }),
      effectifsCrees: t.stringList({ resolve: r => r.effectifs.crees }),
    }),
  })

async function executer(
  ctx: AppContext,
  activiteId: string | number | null | undefined,
  modele: ModeleDeDepart,
  ecrire: boolean
): Promise<ResultatModele> {
  const id = await ctx.exigerActivite(activiteId)
  await ctx.exigerAdminDe(id)
  const organisationId = ctx.organisation!.id
  const lu = lireModeleDeDepart(modele, langueCourante())
  // Seule l'application verrouille l'organisation : la simulation, relancée à
  // chaque ouverture de la fenêtre, ne bloque aucune écriture.
  const executerSous = <T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ) =>
    ecrire
      ? sousVerrouOrganisation(organisationId, operation, { timeout: 60_000 })
      : prisma.$transaction(operation, { timeout: 60_000 })
  const rapport = await executerSous(async tx => {
    // Un modèle ne fusionne jamais avec un contenu existant.
    const perimetres = await tx.perimetre.count({ where: { activiteId: id } })
    if (perimetres > 0) {
      throw erreurSaisie(
        i18n._('Un modèle de départ s’applique à une activité sans périmètre.')
      )
    }
    return appliquerModeleDeDepart(tx, {
      organisationId,
      activiteId: id,
      modele: lu,
      auteurId: ctx.personne!.id,
      ecrire,
    })
  })
  if (ecrire) {
    publierPourActivite('PERIMETRE', organisationId, id)
    publierPourActivite('TACHE', organisationId, id)
  }
  return {
    ...rapport,
    apercu: lu.perimetres.map(p => ({
      slug: p.slug,
      nom: p.nom,
      groupe: p.groupe,
      tachesTypes: lu.taches.get(p.slug)?.length ?? 0,
    })),
    titresFiches: lu.fiches.map(f => f.titre),
    titres: new Map(lu.fiches.map(f => [f.slug, f.titre])),
  }
}

builder.queryFields(t => ({
  simulerModeleDeDepart: t.field({
    type: RapportModeleRef,
    authScopes: { gestion: true },
    description:
      'Décrit un modèle de départ et ce qu’il créerait dans l’activité : rien ne change en base.',
    args: {
      activiteId: t.arg.id(),
      modele: t.arg({ type: ModeleDeDepartEnum, required: true }),
    },
    resolve: (_root, { activiteId, modele }, ctx) =>
      executer(ctx, activiteId, modele, false),
  }),
}))

builder.mutationFields(t => ({
  appliquerModeleDeDepart: t.field({
    type: RapportModeleRef,
    authScopes: { gestion: true },
    description:
      'Crée dans une activité sans périmètre les périmètres, les tâches types et les fiches d’un modèle de départ, puis les tâches de la période courante.',
    args: {
      activiteId: t.arg.id(),
      modele: t.arg({ type: ModeleDeDepartEnum, required: true }),
    },
    resolve: (_root, { activiteId, modele }, ctx) =>
      executer(ctx, activiteId, modele, true),
  }),
}))
