import { describe, expect, it } from 'vitest'

import {
  fusionnerParTache,
  type NotificationLue,
} from './composition-notifications.ts'

let n = 0
const tache = (id: string) => ({
  id,
  editionId: 'e',
  titre: 'Relire les catégories',
  echeance: null,
  perimetreId: 'p',
  edition: { nom: 'E' },
  perimetre: { activiteId: 'a' },
})
const notif = (
  type: NotificationLue['type'],
  champs: { tacheId?: string; personneId?: string; acteurId?: string } = {}
): NotificationLue => ({
  id: `n${++n}`,
  organisationId: 'o',
  type,
  niveau: 'REFERENT',
  jours: null,
  acteurId: champs.acteurId ?? 'lea',
  personneId: champs.personneId ?? null,
  statut: null,
  activiteId: null,
  perimetreId: 'p',
  editionId: null,
  tache: tache(champs.tacheId ?? 't1'),
  fiche: null,
})
// Le résumé lit les notifications de la plus récente à la plus ancienne.
const recentesDabord = (...chrono: NotificationLue[]) => [...chrono].reverse()

describe('fusion des nouvelles d’une tâche (ADR 0065)', () => {
  it('« Léa s’occupe de la tâche à la place de Paul »', () => {
    const retrait = notif('TACHE_DESASSIGNEE', { personneId: 'paul' })
    const ajout = notif('TACHE_ASSIGNEE', { personneId: 'lea' })
    expect(fusionnerParTache(recentesDabord(retrait, ajout))).toEqual([
      { ...ajout, remplaceId: 'paul' },
    ])
  })

  it('une personne retirée puis remise disparaît du résumé', () => {
    const lignes = recentesDabord(
      notif('TACHE_DESASSIGNEE', { personneId: 'paul' }),
      notif('TACHE_ASSIGNEE', { personneId: 'paul' })
    )
    expect(fusionnerParTache(lignes)).toEqual([])
  })

  it('un retrait et un ajout faits par deux personnes restent séparés', () => {
    const retrait = notif('TACHE_DESASSIGNEE', {
      personneId: 'paul',
      acteurId: 'noa',
    })
    const ajout = notif('TACHE_ASSIGNEE', { personneId: 'lea' })
    expect(fusionnerParTache(recentesDabord(retrait, ajout))).toEqual([
      ajout,
      retrait,
    ])
  })

  it('plusieurs modifications d’une tâche gardent la plus récente', () => {
    const derniere = notif('TACHE_STATUT')
    const autre = notif('TACHE_MODIFIEE', { tacheId: 't2' })
    expect(
      fusionnerParTache(
        recentesDabord(notif('TACHE_MODIFIEE'), autre, derniere)
      )
    ).toEqual([derniere, autre])
  })

  it('laisse intactes les nouvelles sans tâche', () => {
    const fiche = { ...notif('FICHE_MODIFIEE'), tache: null }
    expect(fusionnerParTache([fiche])).toEqual([fiche])
  })
})
