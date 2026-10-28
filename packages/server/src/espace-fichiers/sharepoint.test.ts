import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  adresseAutorisation,
  attenteDemandee,
  beneficiaires,
  espaceSharePoint,
  porteeAccordee,
} from './sharepoint.ts'
import { AnnuaireRefuse } from './types.ts'

// Lecture des droits d'un élément par Microsoft Graph (ADR 0044).

describe('SharePoint, droits d’un élément', () => {
  it('lit une personne, un groupe Microsoft 365 et un groupe du site', () => {
    expect(
      beneficiaires({
        id: 'p1',
        grantedToV2: {
          user: {
            id: 'u1',
            displayName: 'Camille',
            email: 'Camille@Exemple.org',
          },
        },
      })
    ).toEqual([
      {
        type: 'personne',
        identifiant: 'u1',
        adresse: 'camille@exemple.org',
        nom: 'Camille',
      },
    ])
    expect(
      beneficiaires({
        id: 'p2',
        grantedToV2: { group: { id: 'g1', displayName: 'Sports' } },
      })
    ).toEqual([{ type: 'groupe', identifiant: 'g1', nom: 'Sports' }])
    expect(
      beneficiaires({
        id: 'p3',
        grantedToV2: { siteGroup: { id: 3, displayName: 'Membres du site' } },
      })
    ).toEqual([
      { type: 'groupe', identifiant: 'site:3', nom: 'Membres du site' },
    ])
  })

  it('lit l’adresse d’un compte du site dans son identifiant de connexion', () => {
    expect(
      beneficiaires({
        id: 'p4',
        grantedToV2: {
          siteUser: {
            displayName: 'Alex',
            loginName: 'i:0#.f|membership|alex@exemple.org',
          },
        },
      })
    ).toEqual([
      {
        type: 'personne',
        identifiant: null,
        adresse: 'alex@exemple.org',
        nom: 'Alex',
      },
    ])
  })

  it('lit « Tout le monde sauf les externes » comme toute l’organisation', () => {
    expect(
      beneficiaires({
        id: 'p8',
        grantedToV2: {
          siteUser: {
            displayName: 'Tout le monde sauf les utilisateurs externes',
            loginName: 'c:0-.f|rolemanager|spo-grid-all-users/abc',
          },
        },
      })
    ).toEqual([{ type: 'domaine', nom: 'Tout le monde sauf les externes' }])
  })

  it('distingue un lien de l’organisation, un lien ouvert et un lien nominatif', () => {
    // Un lien d'organisation n'ouvre le dossier qu'à qui le reçoit.
    expect(
      beneficiaires({ id: 'p5', link: { scope: 'organization' } })
    ).toEqual([{ type: 'lien', nom: 'Lien de l’organisation' }])
    expect(beneficiaires({ id: 'p6', link: { scope: 'anonymous' } })).toEqual([
      { type: 'lien', nom: 'Lien de partage' },
    ])
    expect(
      beneficiaires({
        id: 'p7',
        link: { scope: 'users' },
        grantedToIdentitiesV2: [
          { user: { id: 'u2', displayName: 'Sam' } },
          { user: { id: 'u3', displayName: 'Lou' } },
        ],
      }).map(b => (b.type === 'personne' ? b.identifiant : null))
    ).toEqual(['u2', 'u3'])
  })
})

describe('SharePoint, autorisations demandées', () => {
  const configuration = {
    clientId: 'client',
    clientSecret: 'secret',
    locataire: 'locataire',
    retour: 'https://exemple.org/retour',
  }
  const portees = (adresse: string) =>
    new URL(adresse).searchParams.get('scope')?.split(' ') ?? []

  it('ne lit l’annuaire qu’avec la portée qui le demande', () => {
    const fichiers = portees(adresseAutorisation(configuration, 'e', 'd'))
    expect(fichiers).not.toContain('User.Read.All')
    expect(fichiers).not.toContain('GroupMember.Read.All')
    const annuaire = portees(
      adresseAutorisation(configuration, 'e', 'd', 'ANNUAIRE')
    )
    expect(annuaire).toEqual(
      expect.arrayContaining(['User.Read.All', 'GroupMember.Read.All'])
    )
    expect(annuaire).not.toContain('GroupMember.ReadWrite.All')
  })
})

describe('SharePoint, autorisations accordées', () => {
  const FICHIERS = 'Files.ReadWrite.All Sites.Read.All User.Read profile openid'

  it('garde la portée demandée quand Microsoft accorde tout', () => {
    expect(
      porteeAccordee(
        'ANNUAIRE',
        `${FICHIERS} User.Read.All GroupMember.Read.All`
      )
    ).toBe('ANNUAIRE')
    expect(
      porteeAccordee(
        'GESTION',
        'https://graph.microsoft.com/User.Read.All https://graph.microsoft.com/GroupMember.ReadWrite.All'
      )
    ).toBe('GESTION')
  })

  it('redescend aux fichiers sans la lecture de l’annuaire', () => {
    expect(porteeAccordee('ANNUAIRE', FICHIERS)).toBe('FICHIERS')
    expect(porteeAccordee('GESTION', `${FICHIERS} User.Read.All`)).toBe(
      'FICHIERS'
    )
  })

  it('redescend à la vérification sans l’écriture des groupes', () => {
    expect(
      porteeAccordee(
        'GESTION',
        `${FICHIERS} User.Read.All GroupMember.Read.All`
      )
    ).toBe('ANNUAIRE')
  })

  it('ne dépasse jamais la portée demandée, et la garde sans champ scope', () => {
    expect(
      porteeAccordee(
        'FICHIERS',
        `${FICHIERS} User.Read.All GroupMember.ReadWrite.All`
      )
    ).toBe('FICHIERS')
    expect(porteeAccordee('ANNUAIRE', undefined)).toBe('ANNUAIRE')
  })
})

describe('SharePoint, limites de débit', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('lit l’attente demandée en secondes ou en date, bornée à 30 s', () => {
    vi.useFakeTimers({ now: new Date('2026-10-22T10:00:00Z') })
    expect(attenteDemandee('5')).toBe(5)
    expect(attenteDemandee('120')).toBe(30)
    expect(attenteDemandee('-3')).toBe(0)
    expect(attenteDemandee('Thu, 22 Oct 2026 10:00:04 GMT')).toBe(4)
    expect(attenteDemandee(null)).toBe(2)
    expect(attenteDemandee('plus tard')).toBe(2)
  })

  const position = { emplacement: 'b!drive', base: 'item-1', chemin: [] }
  const annuaire = () =>
    espaceSharePoint(() => Promise.resolve('jeton'), { annuaire: true })
      .annuaire!

  it('reprend la lecture des droits après une limite de débit', async () => {
    const statuts = [429, 200]
    const appels: string[] = []
    vi.stubGlobal('fetch', (adresse: string) => {
      appels.push(adresse)
      const statut = statuts.shift() ?? 200
      return Promise.resolve(
        statut === 429
          ? new Response('', { status: 429, headers: { 'retry-after': '0' } })
          : Response.json({
              value: [
                {
                  id: 'p1',
                  roles: ['read'],
                  grantedToV2: { group: { id: 'g1', displayName: 'Sports' } },
                },
              ],
            })
      )
    })
    expect(await annuaire().droits(position)).toEqual([
      {
        identifiant: 'p1',
        beneficiaire: { type: 'groupe', identifiant: 'g1', nom: 'Sports' },
        role: 'LECTURE',
        herite: false,
      },
    ])
    expect(appels).toHaveLength(2)
  })

  it('ne conclut à aucun droit quand Graph refuse la lecture', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('', { status: 403 }))
    )
    expect(await annuaire().droits(position)).toBeNull()
  })

  it('signale un annuaire refusé au compte connecté', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        Response.json({ responses: [{ id: '0', status: 403, body: {} }] })
      )
    )
    await expect(
      annuaire().chercherComptes(['camille@exemple.fr'])
    ).rejects.toBeInstanceOf(AnnuaireRefuse)
  })
})
