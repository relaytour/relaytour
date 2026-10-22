import { describe, expect, it } from 'vitest'

import { droitsDropbox } from './dropbox.ts'
import { droitGoogle } from './google.ts'
import { droitNextcloud } from './nextcloud.ts'

// Les droits d'un élément chez Google Drive, Nextcloud et Dropbox, dans les mots
// de Relaytour (ADR 0044).

describe('Google Drive', () => {
  it('lit une personne, un groupe, un domaine et un lien', () => {
    expect(
      droitGoogle({
        id: 'p1',
        type: 'user',
        role: 'writer',
        emailAddress: 'Camille@Exemple.org',
        displayName: 'Camille',
      })
    ).toEqual({
      identifiant: 'p1',
      beneficiaire: {
        type: 'personne',
        identifiant: null,
        adresse: 'camille@exemple.org',
        nom: 'Camille',
      },
      role: 'ECRITURE',
      herite: false,
    })
    expect(
      droitGoogle({
        id: 'p2',
        type: 'group',
        role: 'reader',
        emailAddress: 'sports@exemple.org',
        permissionDetails: [{ inherited: true }],
      })
    ).toMatchObject({
      beneficiaire: { type: 'groupe', identifiant: 'sports@exemple.org' },
      role: 'LECTURE',
      herite: true,
    })
    expect(
      droitGoogle({
        id: 'p3',
        type: 'domain',
        role: 'reader',
        domain: 'exemple.org',
      })?.beneficiaire
    ).toEqual({
      type: 'domaine',
      nom: 'Domaine exemple.org',
      domaine: 'exemple.org',
    })
    expect(droitGoogle({ id: 'p4', type: 'anyone' })?.beneficiaire.type).toBe(
      'lien'
    )
  })

  it('ignore un compte supprimé', () => {
    expect(droitGoogle({ id: 'p5', type: 'user', deleted: true })).toBeNull()
  })
})

describe('Nextcloud', () => {
  it('lit un compte, un groupe, une adresse et un lien', () => {
    expect(
      droitNextcloud({
        id: 12,
        share_type: 0,
        share_with: 'camille',
        share_with_displayname: 'Camille',
        share_with_displayname_unique: 'Camille@exemple.org',
        permissions: 31,
      })
    ).toEqual({
      identifiant: '12',
      beneficiaire: {
        type: 'personne',
        identifiant: 'camille',
        adresse: 'camille@exemple.org',
        nom: 'Camille',
      },
      role: 'ECRITURE',
      herite: false,
    })
    expect(
      droitNextcloud({
        id: 13,
        share_type: 1,
        share_with: 'poles',
        permissions: 1,
      })
    ).toMatchObject({
      beneficiaire: { type: 'groupe', identifiant: 'poles' },
      role: 'LECTURE',
    })
    expect(
      droitNextcloud({ id: 14, share_type: 4, share_with: 'Alex@Exemple.net' })
        ?.beneficiaire
    ).toEqual({
      type: 'personne',
      identifiant: null,
      adresse: 'alex@exemple.net',
      nom: 'Alex@Exemple.net',
    })
    expect(droitNextcloud({ id: 15, share_type: 3 })?.beneficiaire.type).toBe(
      'lien'
    )
  })
})

describe('Dropbox', () => {
  it('lit les membres, les groupes et les invitations d’un dossier partagé', () => {
    const droits = droitsDropbox({
      users: [
        {
          access_type: { '.tag': 'owner' },
          user: {
            account_id: 'dbid:1',
            email: 'Camille@Exemple.org',
            display_name: 'Camille',
          },
        },
        {
          access_type: { '.tag': 'viewer' },
          user: { account_id: 'dbid:2', display_name: 'Sans adresse' },
          is_inherited: true,
        },
      ],
      groups: [
        {
          access_type: { '.tag': 'editor' },
          group: { group_id: 'g:1', group_name: 'Pôles' },
        },
      ],
      invitees: [
        {
          access_type: { '.tag': 'viewer' },
          invitee: { '.tag': 'email', email: 'Alex@Exemple.net' },
        },
      ],
    })
    expect(
      droits.map(d => [d.identifiant, d.beneficiaire.type, d.role, d.herite])
    ).toEqual([
      ['email:camille@exemple.org', 'personne', 'ECRITURE', false],
      ['dbid:2', 'personne', 'LECTURE', true],
      ['groupe:g:1', 'groupe', 'ECRITURE', false],
      ['email:alex@exemple.net', 'personne', 'LECTURE', false],
    ])
  })
})
