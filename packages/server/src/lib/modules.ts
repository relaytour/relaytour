import { prisma, type Prisma } from '@relaytour/database'
import { z } from 'zod'

import { erreurSaisie, moduleInactif } from './erreurs.ts'
import { i18n } from './langue.ts'

// Modules d'une activité (ADR 0052).
//
// Un module est un écran facultatif d'une activité, avec ses données et ses envois.
// L'activité porte la liste de ses modules actifs (nulle : tous actifs, comme les
// activités créées avant l'ADR) ; l'administration de l'installation porte la liste
// des modules autorisés de l'organisation (nulle : tous). Un module est actif quand
// les deux listes le contiennent. Désactiver un module ne supprime aucune donnée.

export const MODULES = [
  'AGENDA',
  'BENEVOLES',
  'DOCUMENTS',
  'CLASSEMENT',
] as const

export type Module = (typeof MODULES)[number]

// Le classement rend le score visible par l'équipe (ADR 0056) : une activité à liste
// nulle ne l'active pas. Il ne s'active que nommé dans la liste de l'activité.
const MODULES_PAR_DEFAUT: readonly Module[] = MODULES.filter(
  m => m !== 'CLASSEMENT'
)

const ListeModulesSchema = z.array(z.enum(MODULES))

/**
 * Une liste de modules lue en base. Nulle, elle vaut tous les modules, sauf pour
 * une activité : `parDefaut` exclut alors le classement (ADR 0056). Une valeur
 * inconnue d'une version plus récente est ignorée, après un retour arrière.
 */
export function lireModules(
  brut: unknown,
  parDefaut: readonly Module[] = MODULES
): Module[] {
  if (brut === null || brut === undefined || !Array.isArray(brut)) {
    return [...parDefaut]
  }
  return MODULES.filter(m => brut.includes(m))
}

/** Les modules choisis par une activité : nulle, sa liste vaut les modules par défaut. */
export function lireModulesActivite(brut: unknown): Module[] {
  return lireModules(brut, MODULES_PAR_DEFAUT)
}

/** Une liste reçue d'un admin ou de l'hébergeur, sans doublon, dans l'ordre fixe. */
export function modulesValides(liste: readonly string[]): Module[] {
  const lus = ListeModulesSchema.safeParse(liste)
  if (!lus.success) {
    throw erreurSaisie(i18n._('Cette liste contient un module inconnu.'))
  }
  return MODULES.filter(m => lus.data.includes(m))
}

/** Les modules effectifs : ceux que l'activité active et que l'hébergeur autorise. */
export function modulesActifs(
  activite: { modules: Prisma.JsonValue | null },
  organisation: { modulesAutorises: Prisma.JsonValue | null }
): Module[] {
  const autorises = lireModules(organisation.modulesAutorises)
  return lireModulesActivite(activite.modules).filter(m =>
    autorises.includes(m)
  )
}

type Client = Prisma.TransactionClient | typeof prisma

/** Vrai quand le module est actif dans l'activité. Une activité inconnue : faux. */
export async function moduleActif(
  activiteId: string,
  module: Module,
  db: Client = prisma
): Promise<boolean> {
  const activite = await db.activite.findUnique({
    where: { id: activiteId },
    select: {
      modules: true,
      organisation: { select: { modulesAutorises: true } },
    },
  })
  if (activite === null) return false
  return modulesActifs(activite, activite.organisation).includes(module)
}

/**
 * Refuse une requête sur un module inactif (`MODULE_INACTIF`). Le message nomme
 * l'hébergeur quand c'est lui qui n'autorise pas le module.
 */
export async function exigerModule(
  activiteId: string,
  module: Module,
  db: Client = prisma
): Promise<void> {
  const activite = await db.activite.findUnique({
    where: { id: activiteId },
    select: {
      modules: true,
      organisation: { select: { modulesAutorises: true } },
    },
  })
  if (activite === null) throw moduleInactif()
  if (!lireModules(activite.organisation.modulesAutorises).includes(module)) {
    throw moduleInactif('hebergeur')
  }
  if (!lireModulesActivite(activite.modules).includes(module)) {
    throw moduleInactif()
  }
}

/** Les activités de la liste où le module est actif, dans le même ordre. */
export async function activitesAvecModule(
  activiteIds: readonly string[],
  module: Module,
  db: Client = prisma
): Promise<string[]> {
  if (activiteIds.length === 0) return []
  const lignes = await db.activite.findMany({
    where: { id: { in: [...activiteIds] } },
    select: {
      id: true,
      modules: true,
      organisation: { select: { modulesAutorises: true } },
    },
  })
  const actives = new Set(
    lignes
      .filter(a => modulesActifs(a, a.organisation).includes(module))
      .map(a => a.id)
  )
  return activiteIds.filter(id => actives.has(id))
}
