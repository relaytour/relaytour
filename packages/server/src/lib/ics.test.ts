import { describe, expect, it } from 'vitest'

import { calendrier, echapper, instantIcs, plier } from './ics.ts'

const MAINTENANT = new Date('2026-10-20T08:00:00.000Z')

/** Les lignes dépliées d'un calendrier. */
const deplier = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n')

describe('écriture', () => {
  it('échappe les caractères réservés', () => {
    expect(echapper('Salle 2, étage; accès\\nord\nPorte B')).toBe(
      'Salle 2\\, étage\\; accès\\\\nord\\nPorte B'
    )
  })

  it('plie à 75 octets sans couper un caractère accentué', () => {
    const ligne = `DESCRIPTION:${'é'.repeat(80)}`
    const pliee = plier(ligne)
    const encodeur = new TextEncoder()
    for (const morceau of pliee.split('\r\n')) {
      expect(encodeur.encode(morceau).length).toBeLessThanOrEqual(75)
    }
    expect(pliee.replace(/\r\n /g, '')).toBe(ligne)
    expect(pliee).not.toContain('�')
  })

  it('écrit un instant en UTC', () => {
    expect(instantIcs(new Date('2027-03-01T17:30:00.000Z'))).toBe(
      '20270301T173000Z'
    )
  })
})

describe('calendrier', () => {
  it('écrit une convocation avec son seul participant', () => {
    const ics = calendrier({
      methode: 'REQUEST',
      maintenant: MAINTENANT,
      evenements: [
        {
          uid: 'reunion-abc@orga.exemple.org',
          titre: 'Point natation',
          horaire: {
            debut: new Date('2027-03-01T17:30:00.000Z'),
            fin: new Date('2027-03-01T19:00:00.000Z'),
          },
          lieu: 'Piscine, bassin 2',
          url: 'https://visio.exemple.org/natation',
          sequence: 2,
          organisateur: { nom: 'Rencontres', adresse: 'contact@exemple.org' },
          participant: {
            nom: 'Alex "Coach" Durand',
            adresse: 'alex@exemple.org',
          },
        },
      ],
    })
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).not.toMatch(/[^\r]\n/)
    const lignes = deplier(ics)
    expect(lignes).toEqual(
      expect.arrayContaining([
        'METHOD:REQUEST',
        'UID:reunion-abc@orga.exemple.org',
        'DTSTAMP:20261020T080000Z',
        'DTSTART:20270301T173000Z',
        'DTEND:20270301T190000Z',
        'LOCATION:Piscine\\, bassin 2',
        'SEQUENCE:2',
        'STATUS:CONFIRMED',
        'ORGANIZER;CN="Rencontres":mailto:contact@exemple.org',
        'ATTENDEE;CN="Alex  Coach  Durand";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:alex@exemple.org',
      ])
    )
    expect(lignes.filter(l => l.startsWith('ATTENDEE'))).toHaveLength(1)
  })

  it('écrit une annulation', () => {
    const lignes = deplier(
      calendrier({
        methode: 'CANCEL',
        maintenant: MAINTENANT,
        evenements: [
          {
            uid: 'reunion-abc@orga.exemple.org',
            titre: 'Point natation',
            horaire: {
              debut: new Date('2027-03-01T17:30:00.000Z'),
              fin: new Date('2027-03-01T19:00:00.000Z'),
            },
            sequence: 3,
            annule: true,
          },
        ],
      })
    )
    expect(lignes).toEqual(
      expect.arrayContaining([
        'METHOD:CANCEL',
        'STATUS:CANCELLED',
        'SEQUENCE:3',
      ])
    )
  })

  it('écrit une journée entière avec un dernier jour exclusif', () => {
    const lignes = deplier(
      calendrier({
        maintenant: MAINTENANT,
        nom: 'Rencontres · Agenda',
        fuseau: 'Europe/Paris',
        evenements: [
          {
            uid: 'date-cle-1@orga.exemple.org',
            titre: 'Visite du site',
            horaire: { jour: '2027-02-28', jourFin: '2027-03-01' },
          },
          {
            uid: 'date-cle-2@orga.exemple.org',
            titre: 'Assemblée',
            horaire: { jour: '2027-12-31' },
          },
        ],
      })
    )
    expect(lignes).toEqual(
      expect.arrayContaining([
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Rencontres · Agenda',
        'X-WR-TIMEZONE:Europe/Paris',
        'DTSTART;VALUE=DATE:20270228',
        'DTEND;VALUE=DATE:20270302',
        'DTSTART;VALUE=DATE:20271231',
        'DTEND;VALUE=DATE:20280101',
      ])
    )
  })
})
