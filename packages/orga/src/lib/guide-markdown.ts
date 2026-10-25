import { t } from '@lingui/core/macro'

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

/**
 * Le guide, dans la langue active. Une fonction et non une constante : les
 * messages se traduisent à chaque appel, après un changement de langue.
 * La syntaxe des exemples reste telle quelle, seuls leurs textes se traduisent.
 */
export function guideMarkdown(): SectionDuGuide[] {
  const barre = '\\'
  const etoile = '\\*'
  return [
    {
      id: 'paragraphes',
      titre: t`Paragraphes et retours à la ligne`,
      explications: [
        t`Une ligne vide sépare deux paragraphes. Deux lignes qui se suivent sans ligne vide forment un seul paragraphe.`,
        t`Une barre oblique inverse (${barre}) en fin de ligne passe à la ligne suivante sans changer de paragraphe.`,
      ],
      exemple: [
        t`Le gymnase ouvre à 8 h.`,
        t`Cette ligne continue la phrase précédente.`,
        '',
        t`Une ligne vide commence un nouveau paragraphe.` + barre,
        t`Cette ligne commence sous la précédente.`,
      ].join('\n'),
    },
    {
      id: 'titres',
      titre: t`Titres`,
      explications: [
        t`Un titre commence par des dièses suivis d’une espace. Deux dièses font un titre de section, trois dièses un sous-titre.`,
        t`Le titre de la fiche s’affiche déjà en haut de la page : commencez donc vos sections par deux dièses.`,
      ],
      exemple: [
        `## ${t`Avant la journée`}`,
        '',
        `### ${t`Matériel à réserver`}`,
        '',
        t`Le texte de la section suit le titre.`,
      ].join('\n'),
    },
    {
      id: 'emphase',
      titre: t`Gras, italique et texte barré`,
      explications: [
        t`Deux astérisques de chaque côté mettent un passage en gras. Un tiret bas de chaque côté le met en italique. Deux tildes le barrent.`,
      ],
      exemple: [
        t`Le local ferme **à 19 h précises**.`,
        t`Pensez à _signer la feuille de présence_.`,
        t`Le rendez-vous a lieu ~~au stade~~ au gymnase.`,
      ].join('\n'),
    },
    {
      id: 'listes',
      titre: t`Listes`,
      explications: [
        t`Une liste à puces commence chaque ligne par un tiret suivi d’une espace. Une liste numérotée commence chaque ligne par un nombre suivi d’un point.`,
        t`Sous une puce, deux espaces au début d’une ligne placent l’élément dans une sous-liste.`,
      ],
      exemple: [
        `- ${t`Clés du local`}`,
        `- ${t`Chasubles`}`,
        `  - ${t`20 rouges`}`,
        `  - ${t`20 bleues`}`,
        '',
        `1. ${t`Ouvrir le gymnase`}`,
        `2. ${t`Installer les filets`}`,
        `3. ${t`Accueillir les équipes`}`,
      ].join('\n'),
    },
    {
      id: 'cases',
      titre: t`Cases à cocher`,
      explications: [
        t`Une case commence par un tiret, puis des crochets qui entourent une espace. Un x entre les crochets coche la case.`,
        t`La case se coche en modifiant la fiche, et non d’un clic. Une case de fiche ne crée pas de tâche.`,
      ],
      exemple: [
        `- [x] ${t`Réserver le gymnase`}`,
        `- [ ] ${t`Commander les médailles`}`,
        `- [ ] ${t`Prévenir la mairie`}`,
      ].join('\n'),
    },
    {
      id: 'liens',
      titre: t`Liens`,
      explications: [
        t`Un lien place son texte entre crochets, puis son adresse entre parenthèses. Une adresse écrite seule devient aussi un lien.`,
        t`Un lien de fiche s’ouvre dans un nouvel onglet.`,
      ],
      exemple: [
        t`Consultez le [règlement du tournoi](https://exemple.org/reglement).`,
        '',
        t`Plan d’accès : https://exemple.org/plan`,
      ].join('\n'),
    },
    {
      id: 'tableaux',
      titre: t`Tableaux`,
      explications: [
        t`Une barre verticale sépare les colonnes. La deuxième ligne, faite de tirets, sépare l’en-tête du reste du tableau.`,
        t`Les colonnes n’ont pas besoin d’être alignées dans le texte : l’affichage les aligne.`,
      ],
      exemple: [
        `| ${t`Créneau`} | ${t({ message: 'Terrain', comment: 'En-tête de colonne d’un tableau d’exemple : terrain de sport' })} | ${t({ message: 'Rôle', comment: 'En-tête de colonne d’un tableau d’exemple : rôle d’un bénévole' })} |`,
        '| --- | --- | --- |',
        `| ${t`9 h`} | ${t`Terrain 1`} | ${t`Arbitrage`} |`,
        `| ${t`14 h`} | ${t`Terrain 2`} | ${t`Accueil`} |`,
      ].join('\n'),
    },
    {
      id: 'citations',
      titre: t`Encadrés`,
      explications: [
        t`Un chevron fermant suivi d’une espace place la ligne dans un encadré. Un encadré met en avant une consigne à retenir.`,
      ],
      exemple: `> ${t`Les clés se rendent à l’accueil avant 19 h.`}`,
    },
    {
      id: 'separation',
      titre: t`Ligne de séparation`,
      explications: [
        t`Trois tirets seuls sur une ligne tracent une ligne de séparation. Une ligne vide doit les précéder : sans elle, le texte du dessus devient un titre.`,
      ],
      exemple: [
        t`Fin de la partie matinale.`,
        '',
        '---',
        '',
        t`Début de l’après-midi.`,
      ].join('\n'),
    },
    {
      id: 'code',
      titre: t`Texte tel quel`,
      explications: [
        t`Des accents graves entourent un texte qui s’affiche tel quel, en police à chasse fixe : un nom de fichier, une référence.`,
        t`Trois accents graves sur une ligne ouvrent un bloc de plusieurs lignes, et trois autres le ferment.`,
      ],
      exemple: [
        t`Le fichier s’appelle \`planning-2027.xlsx\`.`,
        '',
        '```',
        t`Terrain 1 : 9 h - 12 h`,
        t`Terrain 2 : 14 h - 18 h`,
        '```',
      ].join('\n'),
    },
    {
      id: 'mentions',
      titre: t`Mentions`,
      explications: [
        t`Une arobase suivie de l’identifiant d’un périmètre le mentionne, par exemple @logistique. Une mention @groupe: suivie de la clé d’un groupe mentionne tout le groupe.`,
        t`Une mention s’affiche comme une étiquette. Celle d’un groupe liste ses périmètres au survol ou à l’appui. Dans l’éditeur, une arobase propose les périmètres et les groupes de l’activité.`,
        t`Une mention ne partage pas la fiche. À l’enregistrement, l’éditeur propose d’ajouter les périmètres mentionnés à la liste « Concerne aussi ».`,
      ],
      exemple: t({
        message:
          'La @logistique prépare les lieux, et chaque @groupe:sport transmet ses horaires.',
        comment:
          'Exemple de syntaxe : les mentions @logistique et @groupe:sport restent telles quelles.',
      }),
    },
    {
      id: 'caracteres',
      titre: t`Caractères réservés`,
      explications: [
        t`Une barre oblique inverse devant un caractère de mise en forme l’affiche tel quel : astérisque, tiret bas, dièse, crochet.`,
        t`Une balise HTML s’affiche comme du texte. Les fiches n’acceptent que la syntaxe Markdown de ce guide.`,
      ],
      exemple: [
        t`Le tarif réduit${etoile} s’applique aux moins de 18 ans.`,
        '',
        `${etoile} ${t`Sur présentation d’une pièce d’identité.`}`,
        '',
        t`<b>Cette balise reste du texte.</b>`,
      ].join('\n'),
    },
  ]
}

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
export function mentionsDuGuide(): Mentions {
  return {
    perimetres: new Map([
      ['logistique', fictif('logistique', t`Logistique`, 'pole')],
    ]),
    groupes: new Map([
      [
        'sport',
        {
          libelle: t`Sports`,
          perimetres: [
            fictif('natation', t`Natation`, 'sport'),
            fictif('volley', t`Volley`, 'sport'),
          ],
        },
      ],
    ]),
    sansLien: true,
  }
}
