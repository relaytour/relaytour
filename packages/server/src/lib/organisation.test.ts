import { pile, themeParDefaut } from '@relaytour/tokens'
import { describe, expect, it } from 'vitest'

import {
  DeclarationOrganisationSchema,
  declarationDepuisEnv,
  resoudreConfiguration,
  resoudreTheme,
} from './organisation.ts'

const ENV = {
  ORGANISATION_NOM: 'Les Rencontres de la Vallée',
  CONTACT_RECRUTEMENT: 'Contact@Exemple.org',
  PAGE_EQUIPE: 'https://exemple.org/equipe',
  COURRIEL_EXPEDITEUR: undefined,
  ORIGINE_ORGA: 'https://orga.exemple.org',
}

describe('declarationDepuisEnv', () => {
  it('lit le nom, les domaines et le contact, en minuscules', () => {
    const d = declarationDepuisEnv(ENV, {
      DOMAINES_COURRIEL_AUTORISES: 'Exemple.org',
    })
    expect(d.slug).toBe('defaut')
    expect(d.nom).toBe('Les Rencontres de la Vallée')
    expect(d.domainesCourrielAutorises).toEqual(['exemple.org'])
    expect(d.contactRecrutement).toBe('contact@exemple.org')
  })

  it('ignore un contact hors des domaines autorisés', () => {
    const d = declarationDepuisEnv(ENV, {})
    expect(d.contactRecrutement).toBeUndefined()
  })
})

describe('resoudreConfiguration', () => {
  it('compose le nom court, l’expéditeur par défaut et le thème par défaut', () => {
    const c = resoudreConfiguration(ENV, declarationDepuisEnv(ENV, {}))
    expect(c.nomCourt).toBe('Les Rencontres de la Vallée')
    expect(c.expediteur).toBe('Les Rencontres de la Vallée <relaytour@localhost>')
    expect(c.origineOrga).toBe('https://orga.exemple.org')
    expect(c.theme).toEqual(themeParDefaut)
    expect(c.id).toBeNull()
  })

  it('préfère le sigle et l’expéditeur de l’environnement', () => {
    const c = resoudreConfiguration(
      { ...ENV, COURRIEL_EXPEDITEUR: 'FSV <fsv@exemple.org>' },
      DeclarationOrganisationSchema.parse({ slug: 'fete-sportive', nom: 'Fête sportive', sigle: 'FSV' })
    )
    expect(c.nomCourt).toBe('FSV')
    expect(c.expediteur).toBe('FSV <fsv@exemple.org>')
  })
})

describe('DeclarationOrganisationSchema', () => {
  const base = { slug: 'fete-sportive', nom: 'Fête sportive', domainesCourrielAutorises: ['exemple.org'] }

  it('accepte une déclaration minimale et pose les valeurs par défaut', () => {
    const d = DeclarationOrganisationSchema.parse({ slug: 'asso', nom: 'Asso' })
    expect(d.fuseauHoraire).toBe('Europe/Paris')
    expect(d.domainesCourrielAutorises).toEqual([])
  })

  it('refuse une clé inconnue, un slug mal formé et un fuseau inconnu', () => {
    expect(DeclarationOrganisationSchema.safeParse({ ...base, couleur: 'x' }).success).toBe(false)
    expect(DeclarationOrganisationSchema.safeParse({ ...base, slug: 'Fête 27' }).success).toBe(false)
    expect(
      DeclarationOrganisationSchema.safeParse({ ...base, fuseauHoraire: 'Mars/Olympus' }).success
    ).toBe(false)
  })

  it('refuse un contact hors des domaines autorisés', () => {
    const r = DeclarationOrganisationSchema.safeParse({
      ...base,
      contactRecrutement: 'contact@autre.org',
    })
    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error?.issues)).toContain('autre.org')
  })

  it('refuse une police hors de la liste et une couleur mal formée', () => {
    expect(
      DeclarationOrganisationSchema.safeParse({ ...base, theme: { polices: { titre: 'Comic' } } })
        .success
    ).toBe(false)
    expect(
      DeclarationOrganisationSchema.safeParse({ ...base, theme: { couleurs: { primaire: 'bleu' } } })
        .success
    ).toBe(false)
  })

  it('refuse un thème qui ne tient pas le contraste AA', () => {
    const r = DeclarationOrganisationSchema.safeParse({
      ...base,
      theme: { couleurs: { primaire: '#FC685F' } },
    })
    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error?.issues)).toContain('contraste')
  })

  it('accepte un thème complet, couleurs et polices', () => {
    const r = DeclarationOrganisationSchema.safeParse({
      ...base,
      theme: {
        couleurs: { encre: '#1F3A2E', primaire: '#2F6B4F', accent: '#8A4B1F', sol2: '#F2F5EF', sol3: '#E4EAE0' },
        polices: { texte: 'Hanken Grotesk', titre: 'Bebas Neue' },
        typographie: { graisseTitre: 400, echelleTitre: 1.35 },
      },
    })
    expect(r.success).toBe(true)
  })

  it('accepte un fond déclaré et refuse un halo trop intense ou une clé inconnue', () => {
    const avec = (fond: unknown) =>
      DeclarationOrganisationSchema.safeParse({ ...base, theme: { fond } }).success
    expect(
      avec({
        transition: '#FDF9F3',
        halo1: { couleur: '#FBBB50', intensite: 0.28 },
        halo2: { couleur: '#F32988', intensite: 0.14 },
      })
    ).toBe(true)
    expect(avec({ halo1: { intensite: 0.5 } })).toBe(false)
    expect(avec({ halo1: { intensite: -0.1 } })).toBe(false)
    expect(avec({ transition: 'crème' })).toBe(false)
    expect(avec({ halo3: { couleur: '#FFFFFF' } })).toBe(false)
  })
})

describe('resoudreTheme', () => {
  it('convertit les polices nommées en piles et complète avec le thème par défaut', () => {
    const t = resoudreTheme({ polices: { titre: 'Bebas Neue' }, couleurs: { primaire: '#2F6B4F' } })
    expect(t.polices.titre).toBe(pile('Bebas Neue'))
    expect(t.polices.texte).toBe(themeParDefaut.polices.texte)
    expect(t.couleurs.primaire).toBe('#2F6B4F')
    expect(t.couleurs.sol3).toBe(themeParDefaut.couleurs.sol3)
  })

  it('garde le fond dérivé sans déclaration et applique le fond déclaré', () => {
    expect(resoudreTheme({ couleurs: { primaire: '#2F6B4F' } }).fond.halo1).toEqual({
      couleur: '#2F6B4F',
      intensite: 0.18,
    })
    const t = resoudreTheme({
      fond: { transition: '#FDF9F3', halo2: { couleur: '#F32988', intensite: 0.14 } },
    })
    expect(t.fond.transition).toBe('#FDF9F3')
    expect(t.fond.halo1).toEqual(themeParDefaut.fond.halo1)
    expect(t.fond.halo2).toEqual({ couleur: '#F32988', intensite: 0.14 })
  })
})
