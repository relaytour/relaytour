import path from 'node:path'

import type { PrismaClient } from '@relaytour/database'
import type { Langue } from '@relaytour/commun'

import {
  groupesValides,
  lireGroupes,
  typeDepuisGroupe,
} from '../lib/activites.ts'
import { marquerContenuModifie } from '../lib/synchronisation.ts'

import { importerFiches, type RapportFiches } from './import-fiches.ts'
import { appliquerConcerneAussi } from './importer.ts'
import { ErreurModeles, lireModeles, type ActiviteModele } from './modeles.ts'
import {
  creerTachesDeLaPeriode,
  rapportTachesVide,
  type RapportTachesDeLaPeriode,
} from './taches-de-la-periode.ts'

// Modèles de départ (ADR 0048) : des activités fictives livrées avec le logiciel,
// qu'un admin applique à une activité sans périmètre. Un modèle apporte des
// périmètres, leurs tâches types et des fiches. Il ne touche ni à l'identité de
// l'organisation, ni à la description de l'activité, ni aux autres activités.
//
// Le premier modèle est l'activité « rencontres » du contenu d'exemple, que la CI
// valide déjà en français et en anglais : aucune copie à tenir à jour.

export const MODELES_DE_DEPART = ['EVENEMENT_MULTISPORTS'] as const
export type ModeleDeDepart = (typeof MODELES_DE_DEPART)[number]

const SOURCES: Record<
  ModeleDeDepart,
  Record<Langue, { dossier: string; activite: string }>
> = {
  EVENEMENT_MULTISPORTS: {
    fr: { dossier: 'exemple', activite: 'rencontres' },
    en: { dossier: 'exemple-en', activite: 'rencontres' },
  },
}

/**
 * Le dossier `content` du dépôt. Le serveur tourne depuis `packages/server`, sur le
 * poste comme dans l'image, où le Dockerfile copie les dossiers d'exemple.
 */
function racineDesContenus(): string {
  return path.resolve(process.cwd(), '../../content')
}

/** L'activité du modèle dans la langue demandée, lue et validée. */
export function lireModeleDeDepart(
  modele: ModeleDeDepart,
  langue: Langue
): ActiviteModele {
  const source = SOURCES[modele][langue]
  const modeles = lireModeles(path.join(racineDesContenus(), source.dossier))
  const activite = modeles.activites.find(
    a => a.declaration.slug === source.activite
  )
  if (activite === undefined) {
    throw new ErreurModeles([
      `le modèle ${modele} ne trouve pas l'activité ${source.activite}`,
    ])
  }
  return activite
}

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export interface RapportModeleDeDepart extends RapportTachesDeLaPeriode {
  /** Les groupes du modèle que l'activité ne déclarait pas, ajoutés à ses groupes. */
  groupesAjoutes: string[]
  perimetres: string[]
  fiches: RapportFiches
  /** La période courante qui reçoit les tâches, ou null sans période ouverte. */
  periode: string | null
}

/**
 * Applique un modèle à une activité sans périmètre. Avec `ecrire` faux, le rapport
 * se calcule sans rien écrire.
 */
export async function appliquerModeleDeDepart(
  tx: Transaction,
  options: {
    organisationId: string
    activiteId: string
    modele: ActiviteModele
    auteurId: string
    ecrire: boolean
  }
): Promise<RapportModeleDeDepart> {
  const { organisationId, activiteId, modele, ecrire } = options
  const activite = await tx.activite.findUniqueOrThrow({
    where: { id: activiteId },
    select: { groupes: true },
  })
  const groupes = lireGroupes(activite.groupes)
  const cles = new Set(groupes.map(g => g.cle))
  const ajoutes = modele.declaration.groupes.filter(g => !cles.has(g.cle))
  // Les groupes ajoutés respectent la borne de l'activité : au-delà de dix, la
  // simulation et l'application refusent, avant toute écriture.
  const fusionnes =
    ajoutes.length === 0 ? groupes : groupesValides([...groupes, ...ajoutes])
  const rapport: RapportModeleDeDepart = {
    ...rapportTachesVide(),
    groupesAjoutes: ajoutes.map(g => g.cle),
    perimetres: modele.perimetres.map(p => p.slug),
    fiches: { creees: [], nouvellesVersions: [], inchangees: [], conflits: [] },
    periode: null,
  }
  if (ecrire && ajoutes.length > 0) {
    await tx.activite.update({
      where: { id: activiteId },
      data: { groupes: fusionnes },
    })
  }

  // Périmètres, avec leurs tâches types et leur effectif par défaut.
  const idsPerimetres = new Map<string, string>()
  if (ecrire) {
    for (const perimetre of modele.perimetres) {
      const cree = await tx.perimetre.create({
        data: {
          organisationId,
          activiteId,
          slug: perimetre.slug,
          nom: perimetre.nom,
          description: perimetre.description ?? null,
          groupe: perimetre.groupe,
          type: typeDepuisGroupe(perimetre.groupe),
          couleur: perimetre.couleur?.toUpperCase() ?? null,
          ordre: perimetre.ordre,
          effectifParDefaut: perimetre.effectif ?? null,
          tachesTypes: modele.taches.get(perimetre.slug) ?? undefined,
        },
        select: { id: true },
      })
      idsPerimetres.set(perimetre.slug, cree.id)
    }
  }

  // Fiches. Une fiche d'une autre activité qui porte le même slug n'est ni
  // déplacée ni remplacée : elle se signale en conflit.
  const { ids: idsFiches } = await importerFiches(
    tx,
    modele.fiches.map(fiche => ({
      slug: fiche.slug,
      titre: fiche.titre,
      contenu: fiche.contenu,
      perimetreId:
        fiche.perimetre === null
          ? null
          : (idsPerimetres.get(fiche.perimetre) ?? null),
    })),
    {
      organisationId,
      activiteId,
      source: 'GIT',
      resume: 'Modèle de départ',
      protegees: ['APP', 'ESPACE_FICHIERS'],
      autreActivite: 'conflit',
      auteurId: options.auteurId,
      ecrire,
    },
    rapport.fiches
  )
  if (ecrire) {
    const enConflit = new Set(rapport.fiches.conflits)
    for (const fiche of modele.fiches) {
      const ficheId = idsFiches.get(fiche.slug)
      if (ficheId === undefined || enConflit.has(fiche.slug)) continue
      await appliquerConcerneAussi(
        tx,
        ficheId,
        fiche.perimetre === null
          ? null
          : (idsPerimetres.get(fiche.perimetre) ?? null),
        fiche.concerne.flatMap(slug => idsPerimetres.get(slug) ?? []),
        fiche.concerneGroupes
      )
    }
    await marquerContenuModifie(organisationId, tx)
  }

  // Tâches de la période courante, si elle existe déjà.
  const periode = await tx.edition.findFirst({
    where: { activiteId, statut: { not: 'ARCHIVEE' } },
    orderBy: { annee: 'desc' },
    select: { id: true, debut: true, nom: true },
  })
  if (periode !== null) {
    rapport.periode = periode.nom
    const conflits = new Set(rapport.fiches.conflits)
    await creerTachesDeLaPeriode(
      tx,
      {
        periode,
        activiteId,
        perimetres: modele.perimetres.map(p => ({
          slug: p.slug,
          groupe: p.groupe,
          id: idsPerimetres.get(p.slug),
          archive: false,
          effectif: p.effectif,
        })),
        taches: modele.taches,
        ficheDe: slug =>
          slug === undefined || conflits.has(slug)
            ? null
            : (idsFiches.get(slug) ?? null),
        ecrire,
      },
      rapport
    )
  }
  return rapport
}
