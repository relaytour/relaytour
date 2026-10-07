import { describe, expect, it } from 'vitest'

import {
  CORPS_MAX,
  INSERABLES,
  LIBELLES,
  LIEN_MAX,
  MODELES,
  MODELE_LIBRE,
  OBJET_MAX,
  TACHES_MAX,
  champParDefaut,
  composer,
  libelleModele,
  lienMailto,
  listerTaches,
  passagesACompleter,
  preparerLien,
  repartir,
  salutation,
  type Informations,
} from './messages'

const informations: Informations = {
  salutation: salutation(null),
  signature: 'Camille Martin',
  organisation: 'Les Rencontres de la Vallée',
  activite: 'Rencontres',
  periode: 'Rencontres 2027',
  dates: 'du 5 juin 2027 au 6 juin 2027',
  perimetre: 'Football',
  lienEspace: 'https://espace.exemple.org/rencontres',
  lienPerimetre: 'https://espace.exemple.org/rencontres/perimetres/football',
  tachesEnCours: '- Réserver le stade',
  tachesEnRetard: '- Commander les maillots',
  postesAPourvoir: 'Sports\n- Volley',
  invitationFormulaire: '',
  contact: 'contact@exemple.org',
  pageEquipe: null,
}

describe('composition d’un modèle', () => {
  it('remplace chaque information connue', () => {
    expect(
      composer('{{salutation}}\n\n{{periode}} : {{perimetre}}', informations)
    ).toBe('Bonjour à toutes et à tous,\n\nRencontres 2027 : Football')
  })

  it('laisse un passage à compléter pour une information manquante', () => {
    expect(composer('Page : {{pageEquipe}}', informations)).toBe(
      'Page : [à compléter : page de l’équipe]'
    )
  })

  it('retire le paragraphe d’une information vide', () => {
    expect(
      composer('Avant\n\n{{invitationFormulaire}}\n\nAprès', informations)
    ).toBe('Avant\n\nAprès')
  })

  it('garde un jeton inconnu tel quel', () => {
    expect(composer('{{inconnu}}', informations)).toBe('{{inconnu}}')
  })

  it('salue une personne seule par son prénom', () => {
    expect(salutation('Alex')).toBe('Bonjour Alex,')
    expect(salutation(null)).toBe('Bonjour à toutes et à tous,')
  })

  it('relève les passages entre crochets, sans doublon', () => {
    expect(
      passagesACompleter('Lieu : [lieu]\nHeure : [heure]\nEncore [lieu]. [x]')
    ).toEqual(['[lieu]', '[heure]'])
  })
})

describe('modèles', () => {
  it('portent une clé unique que le serveur accepte', () => {
    const cles = MODELES.map(m => m.cle)
    expect(new Set(cles).size).toBe(cles.length)
    for (const cle of cles) expect(cle).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    expect(cles).toContain(MODELE_LIBRE)
  })

  it('n’utilisent que des informations connues et tiennent dans les bornes', () => {
    for (const modele of MODELES) {
      const jetons =
        `${modele.objet}${modele.corps}`.match(/\{\{\w+\}\}/g) ?? []
      for (const jeton of jetons) {
        expect(Object.keys(LIBELLES), modele.cle).toContain(jeton.slice(2, -2))
      }
      expect(composer(modele.objet, informations).length).toBeLessThanOrEqual(
        OBJET_MAX
      )
      expect(composer(modele.corps, informations).length).toBeLessThan(
        CORPS_MAX
      )
    }
  })

  it('proposent à l’insertion des informations qui ont un libellé', () => {
    for (const cle of INSERABLES) expect(LIBELLES[cle]).toBeTruthy()
  })

  it('nomment un modèle disparu par sa clé', () => {
    expect(libelleModele('reunion')).toBe('Invitation à une réunion')
    expect(libelleModele('ancien-modele')).toBe('ancien-modele')
  })
})

describe('liste de tâches', () => {
  it('écrit une tâche par ligne, avec son périmètre et son échéance', () => {
    expect(
      listerTaches(
        [
          {
            titre: 'Réserver le stade',
            echeance: '3 mai 2027',
            perimetre: null,
          },
          { titre: 'Tracer le terrain', echeance: null, perimetre: 'Football' },
        ],
        'Aucune tâche.'
      )
    ).toBe(
      '- Réserver le stade (échéance : 3 mai 2027)\n- Football : Tracer le terrain'
    )
  })

  it('résume les tâches au-delà de la limite', () => {
    const taches = Array.from({ length: TACHES_MAX + 2 }, (_, i) => ({
      titre: `Tâche ${i}`,
      echeance: null,
      perimetre: null,
    }))
    const lignes = listerTaches(taches, '').split('\n')
    expect(lignes).toHaveLength(TACHES_MAX + 1)
    expect(lignes.at(-1)).toBe('- et 2 autres tâches')
  })

  it('dit qu’aucune tâche ne correspond', () => {
    expect(listerTaches([], 'Aucune tâche.')).toBe('Aucune tâche.')
  })
})

const alex = { id: 'a', nom: 'Alex Martin', email: 'alex@exemple.org' }
const noa = { id: 'n', nom: 'Noa Petit', email: 'noa@exemple.org' }
const moi = 'camille@exemple.org'

describe('champ des destinataires', () => {
  it('propose « À » pour une personne, « Cci » pour toute la liste, « Cc » pour une sélection', () => {
    expect(champParDefaut(1, false)).toBe('A')
    expect(champParDefaut(1, true)).toBe('A')
    expect(champParDefaut(12, true)).toBe('CCI')
    expect(champParDefaut(3, false)).toBe('CC')
  })

  it('range les adresses dans le champ choisi', () => {
    expect(repartir([alex], 'A', new Set(), moi)).toEqual({
      a: [alex.email],
      cc: [],
      cci: [],
    })
    expect(repartir([alex, noa], 'CC', new Set(), moi)).toEqual({
      a: [],
      cc: [alex.email, noa.email],
      cci: [],
    })
  })

  it('adresse un message en copie cachée à son auteur, avec les copies visibles demandées', () => {
    expect(repartir([alex, noa], 'CCI', new Set(['a']), moi)).toEqual({
      a: [moi],
      cc: [alex.email],
      cci: [noa.email],
    })
  })
})

describe('lien vers la messagerie', () => {
  const envoi = {
    a: [moi],
    cc: [],
    cci: [alex.email, noa.email],
    objet: 'Réunion & suite',
    corps: 'Bonjour,\nÀ jeudi ?',
  }

  it('code l’objet, le texte et les sauts de ligne', () => {
    expect(lienMailto(envoi)).toBe(
      'mailto:camille@exemple.org?bcc=alex@exemple.org,noa@exemple.org' +
        '&subject=R%C3%A9union%20%26%20suite' +
        '&body=Bonjour%2C%0D%0A%C3%80%20jeudi%20%3F'
    )
  })

  it('code une adresse qui porte un caractère réservé', () => {
    expect(
      lienMailto({
        a: ['a+b&c@exemple.org'],
        cc: [],
        cci: [],
        objet: '',
        corps: '',
      })
    ).toBe('mailto:a%2Bb%26c@exemple.org')
  })

  it('garde un lien complet quand il tient dans la longueur admise', () => {
    expect(preparerLien(envoi)).toEqual({
      lien: lienMailto(envoi),
      omis: 'rien',
    })
  })

  it('retire le texte d’un lien trop long', () => {
    const { lien, omis } = preparerLien({
      ...envoi,
      corps: 'é'.repeat(LIEN_MAX),
    })
    expect(omis).toBe('texte')
    expect(lien).not.toContain('body=')
    expect(lien).toContain('bcc=')
    expect(lien.length).toBeLessThanOrEqual(LIEN_MAX)
  })

  it('retire aussi les adresses quand elles dépassent seules la longueur admise', () => {
    const cci = Array.from(
      { length: 200 },
      (_, i) => `personne${i}@exemple.org`
    )
    const { lien, omis } = preparerLien({ ...envoi, cci })
    expect(omis).toBe('adresses')
    expect(lien).toBe('mailto:?subject=R%C3%A9union%20%26%20suite')
  })
})
