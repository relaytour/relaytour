import type { Langue } from '@relaytour/commun'
import type { PrismaClient } from '@relaytour/database'

import { i18n } from './langue.ts'

// Modes d'emploi publics de l'espace organisateur, un par rôle. Le mail
// d'invitation lie celui du rôle de la personne ; le menu du compte lie la liste.

export type RoleModeDEmploi =
  'admin-organisation' | 'admin-activite' | 'referent'

// Des accesseurs : le libellé se compose dans la langue de l'envoi, pas au chargement.
// Chaque libellé complète « Le mode d’emploi … présente vos écrans et vos actions. »
export const LIBELLES_ROLE: Record<RoleModeDEmploi, string> = {
  get 'admin-organisation'() {
    return i18n._(
      'de l’admin de l’organisation',
      {},
      {
        comment:
          'Rôle de la personne, dans « Le mode d’emploi … présente vos écrans et vos actions. »',
      }
    )
  },
  get 'admin-activite'() {
    return i18n._(
      'de l’admin d’activité',
      {},
      {
        comment:
          'Rôle de la personne, dans « Le mode d’emploi … présente vos écrans et vos actions. »',
      }
    )
  },
  get referent() {
    return i18n._(
      'des référentes et référents',
      {},
      {
        comment:
          'Rôle de la personne, dans « Le mode d’emploi … présente vos écrans et vos actions. »',
      }
    )
  },
}

const LISTE_PAR_DEFAUT = 'https://relaytour.org/modes-d-emploi/'
const LISTE_ANGLAISE_PAR_DEFAUT = 'https://relaytour.org/en/modes-d-emploi/'

/**
 * La liste des modes d'emploi dans une langue (ADR 0047). En anglais : la liste
 * déclarée par l'hébergeur, sinon la version anglaise du site de Relaytour quand
 * l'hébergeur garde les modes d'emploi du site, sinon sa liste française.
 */
export function listeDesModesDEmploi(
  env: { MODES_D_EMPLOI_URL: string; MODES_D_EMPLOI_URL_EN?: string },
  langue: Langue
): string {
  if (langue !== 'en') return env.MODES_D_EMPLOI_URL
  if (env.MODES_D_EMPLOI_URL_EN !== undefined) return env.MODES_D_EMPLOI_URL_EN
  // La barre finale est facultative dans MODES_D_EMPLOI_URL.
  const sansBarre = (adresse: string) => adresse.replace(/\/+$/, '')
  return sansBarre(env.MODES_D_EMPLOI_URL) === sansBarre(LISTE_PAR_DEFAUT)
    ? LISTE_ANGLAISE_PAR_DEFAUT
    : env.MODES_D_EMPLOI_URL
}

/**
 * Adresse de la page d'un rôle, à côté de la liste des modes d'emploi. La liste
 * peut être un dossier (`…/modes-d-emploi/` ou `…/modes-d-emploi`) ou une page
 * (`…/modes-d-emploi/index.html`) : la page du rôle se place dans le même dossier.
 */
export function lienModeDEmploi(base: string, role: RoleModeDEmploi): string {
  const liste = new URL(base)
  liste.search = ''
  liste.hash = ''
  const dernier = liste.pathname.split('/').at(-1) ?? ''
  if (dernier !== '' && !dernier.includes('.')) liste.pathname += '/'
  return new URL(`${role}.html`, liste).toString()
}

/**
 * Le rôle le plus large d'une personne dans une organisation : admin de
 * l'organisation, sinon admin d'au moins une activité (ADR 0010), sinon
 * référent·e. Sans organisation connue, toutes ses appartenances comptent.
 */
export async function roleDuModeDEmploi(
  prisma: PrismaClient,
  userId: string,
  organisationId: string | null | undefined
): Promise<RoleModeDEmploi> {
  const dansLOrganisation = organisationId == null ? {} : { organisationId }
  const [admin, adminActivite] = await Promise.all([
    prisma.appartenance.count({
      where: { userId, role: 'ADMIN', ...dansLOrganisation },
    }),
    prisma.adminActivite.count({ where: { userId, ...dansLOrganisation } }),
  ])
  if (admin > 0) return 'admin-organisation'
  if (adminActivite > 0) return 'admin-activite'
  return 'referent'
}
