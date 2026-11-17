import { describe, expect, it } from 'vitest'

import {
  adresseRetourAcceptable,
  adresseRetourAdmise,
  decrireClient,
  dureeDeCache,
  identifiantCimd,
  nomClient,
} from './clients.ts'
import { defiS256, defiValide, verificateurValide } from './jetons.ts'
import { applicationRefusee } from './refus.ts'
import { porteesDemandees } from './routes.ts'

// Règles des clients et des demandes d'autorisation (ADR 0067), sans base.

describe('adresses de retour', () => {
  it('accepte https et la boucle locale en http, refuse le reste', () => {
    expect(adresseRetourAcceptable('https://app.exemple/retour')).toBe(true)
    expect(adresseRetourAcceptable('http://127.0.0.1/retour')).toBe(true)
    expect(adresseRetourAcceptable('http://[::1]:8080/retour')).toBe(true)
    expect(adresseRetourAcceptable('http://app.exemple/retour')).toBe(false)
    expect(adresseRetourAcceptable('http://localhost/retour')).toBe(false)
    expect(adresseRetourAcceptable('https://app.exemple/retour#x')).toBe(false)
    expect(adresseRetourAcceptable('https://moi:secret@app.exemple/')).toBe(
      false
    )
    expect(adresseRetourAcceptable('javascript:alert(1)')).toBe(false)
  })

  it('compare exactement, sauf le port de la boucle locale', () => {
    const declarees = ['https://app.exemple/retour', 'http://127.0.0.1/rappel']
    expect(adresseRetourAdmise(declarees, 'https://app.exemple/retour')).toBe(
      true
    )
    expect(adresseRetourAdmise(declarees, 'https://app.exemple/retour/')).toBe(
      false
    )
    expect(
      adresseRetourAdmise(declarees, 'https://app.exemple/retour?x=1')
    ).toBe(false)
    expect(
      adresseRetourAdmise(declarees, 'http://127.0.0.1:53712/rappel')
    ).toBe(true)
    expect(adresseRetourAdmise(declarees, 'http://127.0.0.1:53712/autre')).toBe(
      false
    )
    expect(adresseRetourAdmise(declarees, 'http://[::1]:53712/rappel')).toBe(
      false
    )
  })
})

describe('identifiant CIMD', () => {
  it('exige une adresse https normalisée avec un chemin', () => {
    expect(identifiantCimd('https://app.exemple/client.json')).not.toBeNull()
    expect(identifiantCimd('https://app.exemple/')).toBeNull()
    expect(identifiantCimd('https://app.exemple')).toBeNull()
    expect(identifiantCimd('http://app.exemple/client.json')).toBeNull()
    expect(identifiantCimd('https://app.exemple/a/../client.json')).toBeNull()
    expect(identifiantCimd('https://APP.exemple/client.json')).toBeNull()
    expect(identifiantCimd('https://app.exemple/client.json#f')).toBeNull()
    expect(identifiantCimd(`https://app.exemple/${'a'.repeat(600)}`)).toBeNull()
  })
})

describe('description d’un client', () => {
  const valide = {
    client_name: 'Automate',
    redirect_uris: ['https://app.exemple/retour'],
  }

  it('garde le nom et les adresses de retour', () => {
    expect(decrireClient(valide)).toEqual({
      nom: 'Automate',
      redirectUris: ['https://app.exemple/retour'],
    })
  })

  it('refuse un nom absent, trop long ou sur plusieurs lignes', () => {
    expect(nomClient('a'.repeat(81))).toBeNull()
    expect(nomClient('Deux\nlignes')).toBeNull()
    expect(nomClient('Séparateur Unicode')).toBeNull()
    expect(nomClient('   ')).toBeNull()
    expect(decrireClient({ ...valide, client_name: undefined })).toBeNull()
  })

  it('refuse un client confidentiel ou un autre parcours', () => {
    expect(
      decrireClient({
        ...valide,
        token_endpoint_auth_method: 'client_secret_basic',
      })
    ).toBeNull()
    expect(decrireClient({ ...valide, grant_types: ['implicit'] })).toBeNull()
    expect(decrireClient({ ...valide, response_types: ['token'] })).toBeNull()
  })

  it('refuse des adresses de retour absentes, invalides ou trop nombreuses', () => {
    expect(decrireClient({ ...valide, redirect_uris: [] })).toBeNull()
    expect(
      decrireClient({ ...valide, redirect_uris: ['http://app.exemple/'] })
    ).toBeNull()
    expect(
      decrireClient({
        ...valide,
        redirect_uris: Array.from(
          { length: 11 },
          (_v, i) => `https://app.exemple/${i}`
        ),
      })
    ).toBeNull()
  })
})

describe('durée de la copie d’un document', () => {
  it('suit Cache-Control, 24 heures au plus', () => {
    expect(dureeDeCache(null)).toBe(0)
    expect(dureeDeCache('no-store')).toBe(0)
    expect(dureeDeCache('public, max-age=600')).toBe(600)
    expect(dureeDeCache('max-age=999999')).toBe(86_400)
    expect(dureeDeCache('no-cache, max-age=600')).toBe(0)
  })
})

describe('PKCE et portées', () => {
  it('vérifie le défi S256 d’un vérificateur', () => {
    const verificateur = 'v'.repeat(43)
    expect(verificateurValide(verificateur)).toBe(true)
    expect(verificateurValide('court')).toBe(false)
    expect(defiValide(defiS256(verificateur))).toBe(true)
  })

  it('lit les portées demandées', () => {
    expect(porteesDemandees(undefined)).toBe('lecture')
    expect(porteesDemandees('lecture')).toBe('lecture')
    expect(porteesDemandees('ecriture')).toBe('lecture ecriture')
    expect(porteesDemandees('lecture ecriture')).toBe('lecture ecriture')
    expect(porteesDemandees('openid')).toBeNull()
  })
})

describe('refus de l’installation', () => {
  const ouvertes = { mode: 'ouvertes' as const, liste: [], refusees: [] }
  const client = 'https://app.exemple/client.json'

  it('accepte tout client valide en mode ouvert', () => {
    expect(applicationRefusee(client, ouvertes)).toBe(false)
  })

  it('refuse par identifiant ou par hôte', () => {
    expect(
      applicationRefusee(client, { ...ouvertes, refusees: [client] })
    ).toBe(true)
    expect(
      applicationRefusee(client, { ...ouvertes, refusees: ['APP.exemple'] })
    ).toBe(true)
    expect(
      applicationRefusee(client, { ...ouvertes, refusees: ['autre.exemple'] })
    ).toBe(false)
    // Un autre port ne contourne pas le refus d'un hôte.
    const autrePort = 'https://app.exemple:8443/client.json'
    expect(
      applicationRefusee(autrePort, { ...ouvertes, refusees: ['app.exemple'] })
    ).toBe(true)
    expect(
      applicationRefusee(autrePort, {
        ...ouvertes,
        refusees: ['app.exemple:8443'],
      })
    ).toBe(true)
    expect(
      applicationRefusee(client, {
        ...ouvertes,
        refusees: ['app.exemple:8443'],
      })
    ).toBe(false)
  })

  it('n’accepte que la liste en mode liste, et rien en mode fermé', () => {
    const liste = { mode: 'liste' as const, liste: [client], refusees: [] }
    expect(applicationRefusee(client, liste)).toBe(false)
    expect(applicationRefusee('https://autre.exemple/c.json', liste)).toBe(true)
    expect(applicationRefusee(client, { ...ouvertes, mode: 'fermees' })).toBe(
      true
    )
  })
})
