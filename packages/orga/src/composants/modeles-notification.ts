import { useLingui } from '@lingui/react/macro'

import type { ModeleNotification } from '../gql/graphql'

export interface ModeleAffiche {
  valeur: ModeleNotification
  titre: string
  detail: string
}

/** Les modèles de notifications, avec leur nom et ce qu'ils règlent (ADR 0065). */
export function useModelesNotification(): ModeleAffiche[] {
  const { t } = useLingui()
  return [
    {
      valeur: 'ESSENTIEL',
      titre: t`Essentiel`,
      detail: t`Ce qui vous concerne : vos tâches, vos échéances, vos réunions et les demandes à traiter. Le mail des priorités remplace le résumé de la semaine.`,
    },
    {
      valeur: 'REFERENT',
      titre: t`Référent·e`,
      detail: t`L’essentiel, et le suivi de vos périmètres : tâches à prendre, tâches faites, déclinaisons.`,
    },
    {
      valeur: 'CONTACT_PRINCIPAL',
      titre: t`Contact principal`,
      detail: t`Le suivi de vos périmètres, tout le détail des périmètres dont vous êtes contact principal et un résumé chaque matin.`,
    },
    {
      valeur: 'ADMIN_ACTIVITE',
      titre: t`Admin d’activité`,
      detail: t`Le suivi de vos périmètres, toutes les nouvelles de l’équipe, les priorités de toute l’activité et un résumé chaque matin.`,
    },
  ]
}
