import type { Mentions, PerimetreMentionnable } from './mentions'

// Le guide de la syntaxe Markdown des fiches. Il ne présente que ce que le rendu
// des fiches affiche (composants/Markdown.tsx : react-markdown et remark-gfm, sans
// HTML). La page « Écrire une fiche en Markdown » du site reprend ces exemples.

export interface SectionDuGuide {
  id: string
  titre: string
  explications: string[]
  exemple: string
}

export const GUIDE_MARKDOWN: SectionDuGuide[] = [
  {
    id: 'paragraphes',
    titre: 'Paragraphes et retours à la ligne',
    explications: [
      'Une ligne vide sépare deux paragraphes. Deux lignes qui se suivent sans ligne vide forment un seul paragraphe.',
      'Une barre oblique inverse (\\) en fin de ligne passe à la ligne suivante sans changer de paragraphe.',
    ],
    exemple: [
      'Le gymnase ouvre à 8 h.',
      'Cette ligne continue la phrase précédente.',
      '',
      'Une ligne vide commence un nouveau paragraphe.\\',
      'Cette ligne commence sous la précédente.',
    ].join('\n'),
  },
  {
    id: 'titres',
    titre: 'Titres',
    explications: [
      'Un titre commence par des dièses suivis d’une espace. Deux dièses font un titre de section, trois dièses un sous-titre.',
      'Le titre de la fiche s’affiche déjà en haut de la page : commencez donc vos sections par deux dièses.',
    ],
    exemple: [
      '## Avant la journée',
      '',
      '### Matériel à réserver',
      '',
      'Le texte de la section suit le titre.',
    ].join('\n'),
  },
  {
    id: 'emphase',
    titre: 'Gras, italique et texte barré',
    explications: [
      'Deux astérisques de chaque côté mettent un passage en gras. Un tiret bas de chaque côté le met en italique. Deux tildes le barrent.',
    ],
    exemple: [
      'Le local ferme **à 19 h précises**.',
      'Pensez à _signer la feuille de présence_.',
      'Le rendez-vous a lieu ~~au stade~~ au gymnase.',
    ].join('\n'),
  },
  {
    id: 'listes',
    titre: 'Listes',
    explications: [
      'Une liste à puces commence chaque ligne par un tiret suivi d’une espace. Une liste numérotée commence chaque ligne par un nombre suivi d’un point.',
      'Sous une puce, deux espaces au début d’une ligne placent l’élément dans une sous-liste.',
    ],
    exemple: [
      '- Clés du local',
      '- Chasubles',
      '  - 20 rouges',
      '  - 20 bleues',
      '',
      '1. Ouvrir le gymnase',
      '2. Installer les filets',
      '3. Accueillir les équipes',
    ].join('\n'),
  },
  {
    id: 'cases',
    titre: 'Cases à cocher',
    explications: [
      'Une case commence par un tiret, puis des crochets qui entourent une espace. Un x entre les crochets coche la case.',
      'La case se coche en modifiant la fiche, et non d’un clic. Une case de fiche ne crée pas de tâche.',
    ],
    exemple: [
      '- [x] Réserver le gymnase',
      '- [ ] Commander les médailles',
      '- [ ] Prévenir la mairie',
    ].join('\n'),
  },
  {
    id: 'liens',
    titre: 'Liens',
    explications: [
      'Un lien place son texte entre crochets, puis son adresse entre parenthèses. Une adresse écrite seule devient aussi un lien.',
      'Un lien de fiche s’ouvre dans un nouvel onglet.',
    ],
    exemple: [
      'Consultez le [règlement du tournoi](https://exemple.org/reglement).',
      '',
      'Plan d’accès : https://exemple.org/plan',
    ].join('\n'),
  },
  {
    id: 'tableaux',
    titre: 'Tableaux',
    explications: [
      'Une barre verticale sépare les colonnes. La deuxième ligne, faite de tirets, sépare l’en-tête du reste du tableau.',
      'Les colonnes n’ont pas besoin d’être alignées dans le texte : l’affichage les aligne.',
    ],
    exemple: [
      '| Créneau | Terrain | Rôle |',
      '| --- | --- | --- |',
      '| 9 h | Terrain 1 | Arbitrage |',
      '| 14 h | Terrain 2 | Accueil |',
    ].join('\n'),
  },
  {
    id: 'citations',
    titre: 'Encadrés',
    explications: [
      'Un chevron fermant suivi d’une espace place la ligne dans un encadré. Un encadré met en avant une consigne à retenir.',
    ],
    exemple: '> Les clés se rendent à l’accueil avant 19 h.',
  },
  {
    id: 'separation',
    titre: 'Ligne de séparation',
    explications: [
      'Trois tirets seuls sur une ligne tracent une ligne de séparation. Une ligne vide doit les précéder : sans elle, le texte du dessus devient un titre.',
    ],
    exemple: [
      'Fin de la partie matinale.',
      '',
      '---',
      '',
      'Début de l’après-midi.',
    ].join('\n'),
  },
  {
    id: 'code',
    titre: 'Texte tel quel',
    explications: [
      'Des accents graves entourent un texte qui s’affiche tel quel, en police à chasse fixe : un nom de fichier, une référence.',
      'Trois accents graves sur une ligne ouvrent un bloc de plusieurs lignes, et trois autres le ferment.',
    ],
    exemple: [
      'Le fichier s’appelle `planning-2027.xlsx`.',
      '',
      '```',
      'Terrain 1 : 9 h - 12 h',
      'Terrain 2 : 14 h - 18 h',
      '```',
    ].join('\n'),
  },
  {
    id: 'mentions',
    titre: 'Mentions',
    explications: [
      'Une arobase suivie de l’identifiant d’un périmètre le mentionne, par exemple @logistique. Une mention @groupe: suivie de la clé d’un groupe mentionne tout le groupe.',
      'Une mention s’affiche comme une étiquette. Celle d’un groupe liste ses périmètres au survol ou à l’appui. Dans l’éditeur, une arobase propose les périmètres et les groupes de l’activité.',
      'Une mention ne partage pas la fiche. À l’enregistrement, l’éditeur propose d’ajouter les périmètres mentionnés à la liste « Concerne aussi ».',
    ],
    exemple:
      'La @logistique prépare les lieux, et chaque @groupe:sport transmet ses horaires.',
  },
  {
    id: 'caracteres',
    titre: 'Caractères réservés',
    explications: [
      'Une barre oblique inverse devant un caractère de mise en forme l’affiche tel quel : astérisque, tiret bas, dièse, crochet.',
      'Une balise HTML s’affiche comme du texte. Les fiches n’acceptent que la syntaxe Markdown de ce guide.',
    ],
    exemple: [
      'Le tarif réduit\\* s’applique aux moins de 18 ans.',
      '',
      '\\* Sur présentation d’une pièce d’identité.',
      '',
      '<b>Cette balise reste du texte.</b>',
    ].join('\n'),
  },
]

const fictif = (
  slug: string,
  nom: string,
  groupe: string
): PerimetreMentionnable => ({
  id: slug,
  slug,
  nom,
  couleur: null,
  groupe,
})

/** Des périmètres fictifs, pour que les exemples du guide affichent leurs mentions. */
export const MENTIONS_DU_GUIDE: Mentions = {
  perimetres: new Map([
    ['logistique', fictif('logistique', 'Logistique', 'pole')],
  ]),
  groupes: new Map([
    [
      'sport',
      {
        libelle: 'Sports',
        perimetres: [
          fictif('natation', 'Natation', 'sport'),
          fictif('volley', 'Volley', 'sport'),
        ],
      },
    ],
  ]),
  sansLien: true,
}
