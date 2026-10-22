import { describe, expect, it } from 'vitest'

import { adresseAutorisation, beneficiaires } from './sharepoint.ts'

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

  it('distingue un lien de l’organisation, un lien ouvert et un lien nominatif', () => {
    expect(
      beneficiaires({ id: 'p5', link: { scope: 'organization' } })
    ).toEqual([{ type: 'domaine', nom: 'Toute l’organisation' }])
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
