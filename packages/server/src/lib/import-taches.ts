import type { PrismaClient } from '@relaytour/database'
import { sansAccent } from '@relaytour/commun'

import { lireGroupes, typeDepuisGroupe } from './activites.ts'
import { i18n } from './langue.ts'
import { decaler, ecartEnJours } from './reconduction.ts'
import { DESCRIPTION_TACHE_MAX, TITRE_MAX } from './saisie.ts'
import { marquerContenuModifie } from './synchronisation.ts'
import { lireTachesTypes, type TacheModele } from '../orga/modeles.ts'

// Import des tâches d'une période depuis un tableur (ADR 0049). Le navigateur lit
// le fichier et n'envoie que les colonnes associées, ligne par ligne. Le serveur
// retrouve le périmètre, la fiche et la personne responsable, écarte ce qu'il ne
// peut pas importer et ne crée jamais deux fois la même tâche. Une tâche importée
// n'a pas d'auteur : elle ne rapporte aucun point de création (score).

type Transaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

export type EtatLigne = 'A_IMPORTER' | 'DEJA_IMPORTEE' | 'ECARTEE' | 'IMPORTEE'

export interface LigneRapport {
  /** Le numéro de la ligne dans le fichier, en-têtes compris. */
  ligne: number
  etat: EtatLigne
  raison: string | null
  /** Ce qui n'empêche pas l'import : une fiche ou une personne introuvable. */
  avertissements: string[]
}

export interface LigneTache {
  ligne: number
  perimetre: string
  titre: string
  description?: string | null
  /** Une date AAAA-MM-JJ, ou un décalage depuis le premier jour : J-30, J+3. */
  echeance?: string | null
  /** Le titre ou l'identifiant d'une fiche de l'activité. */
  fiche?: string | null
  /** L'adresse d'une personne affectée au périmètre pour la période. */
  responsable?: string | null
}

export interface OptionsImportTaches {
  organisationId: string
  activiteId: string
  edition: { id: string; debut: Date }
  /** Le groupe des périmètres à créer ; null : un périmètre inconnu écarte sa ligne. */
  groupeNouveaux: string | null
  /** Ajoute aussi chaque tâche aux tâches types de son périmètre. */
  enregistrerTachesTypes: boolean
  ecrire: boolean
}

export interface RapportImportTaches {
  lignes: LigneRapport[]
  perimetresCrees: string[]
  tachesTypesAjoutees: number
}

const RELATIVE = /^J\s*([-+])\s*(\d{1,3})$/i
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Un identifiant lisible tiré d'un texte : minuscules, chiffres et tirets. */
function slugDe(texte: string): string {
  return (
    sansAccent(texte)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50)
      .replace(/-+$/, '') || 'element'
  )
}

/** Un identifiant libre parmi ceux déjà pris : « plan », puis « plan-2 »… */
function slugLibre(base: string, pris: Set<string>): string {
  let slug = base
  for (let n = 2; pris.has(slug); n += 1) slug = `${base}-${n}`
  pris.add(slug)
  return slug
}

/** L'échéance lue : sa date, et son décalage en jours depuis le premier jour. */
function lireEcheance(
  brute: string | null | undefined,
  debut: Date
): { date: Date | null; jours: number | null } | 'illisible' {
  const texte = (brute ?? '').trim()
  if (texte === '') return { date: null, jours: null }
  const relative = RELATIVE.exec(texte)
  if (relative) {
    const jours = Number(relative[2]) * (relative[1] === '-' ? -1 : 1)
    return { date: decaler(debut, jours), jours }
  }
  const m = DATE.exec(texte)
  if (m) {
    const date = new Date(
      Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    )
    if (date.toISOString().slice(0, 10) !== texte) return 'illisible'
    return { date, jours: ecartEnJours(debut, date) }
  }
  return 'illisible'
}

const cle = (texte: string) => sansAccent(texte)

/** Calcule l'import et, avec `ecrire`, crée les tâches, les périmètres et les tâches types. */
export async function importerTaches(
  tx: Transaction,
  lignes: readonly LigneTache[],
  options: OptionsImportTaches
): Promise<RapportImportTaches> {
  const { organisationId, activiteId, edition, ecrire } = options
  if (ecrire) {
    // Deux imports simultanés dans la même période ne créent pas deux fois les
    // mêmes tâches : le second attend la fin du premier, puis les trouve.
    await tx.$queryRaw`SELECT id FROM Edition WHERE id = ${edition.id} FOR UPDATE`
  }
  const rapport: RapportImportTaches = {
    lignes: [],
    perimetresCrees: [],
    tachesTypesAjoutees: 0,
  }

  // Périmètres actifs, retrouvés par leur nom ou leur identifiant.
  const perimetres = await tx.perimetre.findMany({
    where: { activiteId },
    select: {
      id: true,
      slug: true,
      nom: true,
      archivedAt: true,
      tachesTypes: true,
    },
  })
  const slugsPris = new Set(perimetres.map(p => p.slug))
  interface PerimetreConnu {
    id: string
    slug: string
    types: TacheModele[]
    typesChanges: boolean
  }
  const parCle = new Map<string, PerimetreConnu>()
  for (const p of perimetres) {
    if (p.archivedAt !== null) continue
    const connu = {
      id: p.id,
      slug: p.slug,
      types: lireTachesTypes(p.tachesTypes) ?? [],
      typesChanges: false,
    }
    parCle.set(cle(p.nom), connu)
    parCle.set(p.slug, connu)
  }
  const groupes = lireGroupes(
    (
      await tx.activite.findUniqueOrThrow({
        where: { id: activiteId },
        select: { groupes: true },
      })
    ).groupes
  )
  const groupe =
    options.groupeNouveaux !== null &&
    groupes.some(g => g.cle === options.groupeNouveaux)
      ? options.groupeNouveaux
      : null

  // Fiches de l'activité, retrouvées par leur titre ou leur identifiant.
  const fiches = await tx.fiche.findMany({
    where: { activiteId, archivedAt: null },
    select: {
      id: true,
      slug: true,
      perimetreId: true,
      versionCourante: { select: { titre: true } },
    },
  })
  const ficheDe = new Map<string, (typeof fiches)[number]>()
  for (const f of fiches) {
    ficheDe.set(f.slug, f)
    if (f.versionCourante) ficheDe.set(cle(f.versionCourante.titre), f)
  }

  // Personnes affectées à chaque périmètre pour la période, par adresse.
  const affectations = await tx.affectation.findMany({
    where: { editionId: edition.id },
    select: {
      perimetreId: true,
      userId: true,
      user: { select: { email: true } },
    },
  })
  const affectee = new Map<string, string>()
  for (const a of affectations) {
    affectee.set(`${a.perimetreId}|${a.user.email.toLowerCase()}`, a.userId)
  }

  // Tâches déjà présentes : même périmètre, même titre, même échéance.
  const empreinte = (perimetreId: string, titre: string, date: Date | null) =>
    `${perimetreId}|${cle(titre)}|${date?.toISOString().slice(0, 10) ?? ''}`
  const presentes = new Set(
    (
      await tx.tache.findMany({
        where: { editionId: edition.id },
        select: { perimetreId: true, titre: true, echeance: true },
      })
    ).map(t => empreinte(t.perimetreId, t.titre, t.echeance))
  )

  for (const ligne of lignes) {
    const sortie: LigneRapport = {
      ligne: ligne.ligne,
      etat: ecrire ? 'IMPORTEE' : 'A_IMPORTER',
      raison: null,
      avertissements: [],
    }
    rapport.lignes.push(sortie)
    const ecarter = (raison: string) => {
      sortie.etat = 'ECARTEE'
      sortie.raison = raison
    }
    const titre = ligne.titre.trim()
    const nomPerimetre = ligne.perimetre.trim()
    if (titre === '') {
      ecarter(i18n._('Le titre est vide.'))
      continue
    }
    if (titre.length > TITRE_MAX) {
      ecarter(i18n._('Le titre dépasse {max} caractères.', { max: TITRE_MAX }))
      continue
    }
    const description = ligne.description?.trim() || null
    if (description !== null && description.length > DESCRIPTION_TACHE_MAX) {
      ecarter(
        i18n._('La description dépasse {max} caractères.', {
          max: DESCRIPTION_TACHE_MAX,
        })
      )
      continue
    }
    const echeance = lireEcheance(ligne.echeance, edition.debut)
    if (echeance === 'illisible') {
      const brute = ligne.echeance ?? ''
      ecarter(
        i18n._('Échéance illisible : « {echeance} ».', { echeance: brute })
      )
      continue
    }

    // Périmètre : connu, créé par cet import, ou inconnu.
    let perimetre =
      nomPerimetre === '' ? undefined : parCle.get(cle(nomPerimetre))
    if (perimetre === undefined) {
      if (nomPerimetre === '') {
        ecarter(i18n._('Le périmètre est vide.'))
        continue
      }
      if (groupe === null) {
        ecarter(
          i18n._('Périmètre inconnu : « {perimetre} ».', {
            perimetre: nomPerimetre,
          })
        )
        continue
      }
      const slug = slugLibre(slugDe(nomPerimetre), slugsPris)
      let id = `nouveau:${slug}`
      if (ecrire) {
        id = (
          await tx.perimetre.create({
            data: {
              organisationId,
              activiteId,
              slug,
              nom: nomPerimetre.slice(0, 120),
              groupe,
              type: typeDepuisGroupe(groupe),
            },
            select: { id: true },
          })
        ).id
      }
      perimetre = { id, slug, types: [], typesChanges: false }
      parCle.set(cle(nomPerimetre), perimetre)
      rapport.perimetresCrees.push(nomPerimetre)
    }

    const date = echeance.date
    const marque = empreinte(perimetre.id, titre, date)
    if (presentes.has(marque)) {
      sortie.etat = 'DEJA_IMPORTEE'
      continue
    }
    presentes.add(marque)

    // Fiche : commune, ou du périmètre de la tâche.
    let ficheId: string | null = null
    let ficheSlug: string | undefined
    const nomFiche = ligne.fiche?.trim() ?? ''
    if (nomFiche !== '') {
      const fiche = ficheDe.get(nomFiche) ?? ficheDe.get(cle(nomFiche))
      if (fiche === undefined) {
        sortie.avertissements.push(
          i18n._('Fiche introuvable : « {fiche} ».', { fiche: nomFiche })
        )
      } else if (
        fiche.perimetreId !== null &&
        fiche.perimetreId !== perimetre.id
      ) {
        sortie.avertissements.push(
          i18n._('La fiche « {fiche} » appartient à un autre périmètre.', {
            fiche: nomFiche,
          })
        )
      } else {
        ficheId = fiche.id
        ficheSlug = fiche.slug
      }
    }

    // Personne responsable : affectée au périmètre pour la période.
    let responsableId: string | null = null
    const adresse = ligne.responsable?.trim().toLowerCase() ?? ''
    if (adresse !== '') {
      responsableId = affectee.get(`${perimetre.id}|${adresse}`) ?? null
      if (responsableId === null) {
        sortie.avertissements.push(
          i18n._(
            '« {adresse} » n’est pas affecté·e à ce périmètre pour la période : la tâche reste sans personne assignée.',
            { adresse }
          )
        )
      }
    }

    // Tâche type, si l'admin le demande et qu'aucune tâche type ne porte ce titre.
    let modeleSlug: string | null = null
    if (options.enregistrerTachesTypes) {
      const existante = perimetre.types.find(t => cle(t.titre) === cle(titre))
      if (existante !== undefined) {
        modeleSlug = existante.modele
      } else {
        const pris = new Set(perimetre.types.map(t => t.modele))
        modeleSlug = slugLibre(slugDe(titre), pris)
        const type: TacheModele = {
          modele: modeleSlug,
          titre,
          ...(description === null ? {} : { description }),
          // Une tâche type compte au plus 999 jours depuis le premier jour.
          ...(echeance.jours === null || Math.abs(echeance.jours) > 999
            ? {}
            : {
                echeance: `J${echeance.jours < 0 ? '-' : '+'}${Math.abs(echeance.jours)}`,
              }),
          ...(ficheSlug === undefined ? {} : { fiche: ficheSlug }),
        }
        perimetre.types.push(type)
        perimetre.typesChanges = true
        rapport.tachesTypesAjoutees += 1
      }
    }

    if (!ecrire) continue
    await tx.tache.create({
      data: {
        editionId: edition.id,
        perimetreId: perimetre.id,
        titre,
        description,
        echeance: date,
        ficheId,
        modeleSlug,
        ...(responsableId === null
          ? {}
          : { assignations: { create: { userId: responsableId } } }),
      },
    })
  }

  if (ecrire) {
    const changes = new Set([...parCle.values()].filter(p => p.typesChanges))
    for (const p of changes) {
      await tx.perimetre.update({
        where: { id: p.id },
        data: { tachesTypes: p.types, version: { increment: 1 } },
      })
    }
    if (changes.size > 0 || rapport.perimetresCrees.length > 0) {
      await marquerContenuModifie(organisationId, tx)
    }
  }
  return rapport
}
