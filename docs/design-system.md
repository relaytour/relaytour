# Design system de Relaytour

Ce document décrit l'identité par défaut de Relaytour, son matériau et ses composants. Le site de présentation en montre une version vivante (`site/design-system.html`). Les valeurs font foi dans le code : `packages/tokens/src/index.ts` pour le thème, `packages/orga/src/global.css` pour le matériau.

## Principes

- Relaytour sert toutes les organisations. Son identité par défaut ne fait référence à aucun sport ni à aucune association.
- Le matériau visuel (verre, rayons, ombres, mouvement) appartient à Relaytour. Il reste le même pour toutes les organisations.
- Une organisation fournit seulement sa palette, ses polices, la typographie de ses titres et son fond (ADR 0006).
- Une couleur identifie un périmètre, jamais une section. Elle sert de repère : pastille, filet, étiquette.
- Chaque couleur de texte atteint 4,5:1 de contraste sur toutes les surfaces où elle apparaît.
- Aucune police servie par un tiers : les familles sont embarquées par paquets fontsource, sous licence OFL.
- Ant Design reste le socle des composants. Le design system l'habille par ses jetons et par une feuille de style, sans le réécrire.

Décisions du 18 et du 19 septembre 2026, après une planche de fondations et un écran type maquettés en trois thèmes.

## Palette par défaut « bleu-vert »

| Rôle | Valeur | Usage |
|---|---|---|
| encre | `#1B2730` | texte, icônes, ombres ; les autres textes sont des transparences de l'encre |
| primaire | `#1E5A63` | actions principales, liens, élément de menu actif |
| primaire clair | `#DCEAEB` | état « en cours », choix actif, en-têtes de tableau |
| accent | `#AD412B` | engagement d'une personne (« Je m'en occupe »), notification non lue |
| accent clair | `#F6E1DB` | fond des éléments accentués |
| succès | `#3A7042` / `#E3F0E4` | tâche faite |
| alerte | `#8A5A0E` / `#FBF0D8` | échéance proche, tâche sans personne, fiche liée |
| erreur | `#A23A2C` / `#F8E3DF` | retard ; une brique sourde, jamais un rouge vif |
| sol | `#FFFFFF`, `#F4F6F7`, `#E9EEF0` | dégradé fixe à 138°, bande dense au milieu |

Le test `packages/tokens/src/index.test.ts` vérifie le contraste de chaque couleur de texte sur le blanc, sur la bande dense du sol et sur l'arrêt de transition.

Le thème alternatif « encre-lagon » garde la même palette. Les actions passent en encre (`#1B2730`) et un seul accent lagon (`#136D6C`) les accompagne. Il est livré avec l'application, et une organisation peut le demander tel quel.

## Fond

Le fond d'un thème se compose du dégradé du sol et de deux halos.

- Le dégradé part de `sol1`, passe par l'arrêt de `transition` à 18 %, par `sol2` à 46 %, `sol3` à 60 %, `sol2` à 78 %, et revient à `sol1`.
- L'arrêt de transition permet un blanc crème entre le blanc et la bande claire.
- Les deux halos sont des taches floues et fixes derrière le verre. Chacun a une couleur et une intensité, de 0 à 0,35. Au-delà, un halo gênerait la lecture.
- Une organisation déclare ces valeurs dans le bloc `fond` de son thème. Sans déclaration, la transition reprend `sol1`, le premier halo prend la primaire à 18 % et le second l'accent à 13 %.
- Le sol se pose sur `html` seul. Un fond sur `body` se peindrait au-dessus des halos.

## Hiérarchie du texte

Tous les textes sont des transparences de l'encre, jamais des gris nouveaux.

| Opacité | Variable | Usage |
|---|---|---|
| 100 % | `--rt-encre` | titres, texte principal |
| 84 % | `--rt-encre-80` | texte courant d'une carte, comme la description d'une tâche |
| 78 % | `--rt-encre-70` | texte secondaire (`colorTextSecondary` d'antd) |
| 64 % | `--rt-encre-55` | texte muet, comptes en mono (`colorTextTertiary`) |
| 38 % | `--rt-encre-40` | icônes inactives |
| 12 et 7 % | `--rt-encre-14`, `--rt-encre-08` | filets et fonds |

Les noms des variables datent des premières valeurs. Les gris ont été relevés le 19 septembre 2026 : sur le verre teinté, 52 % descendait à 3,1:1 et 68 % restait peu lisible.

## Polices

- Hanken Grotesk sert l'interface et les titres, en graisse 600 et avec un espacement de −0,02 em.
- IBM Plex Mono sert les dates, les heures, les identifiants, les comptes et les libellés en capitales espacées.
- Bebas Neue et Quicksand restent embarquées pour un thème d'organisation qui les nomme.
- La casse de phrase s'applique partout. Aucun titre n'est en capitales.

## Logotype

- Le pictogramme est formé de deux arcs qui se passent le relais. Le premier prend la primaire, le second l'accent.
- Il reste lisible à 16 pixels (`packages/orga/public/favicon.svg`).
- Le nom s'écrit en Hanken Grotesk 600, avec un espacement de −0,02 em.
- Le composant `Marque` affiche le pictogramme et le nom de l'organisation.

## Matériau

### Verres

| Verre | Classe ou variable | Usage |
|---|---|---|
| Panneau | `.rt-verre` | panneaux, cartes de fiche, formulaires ; blanc de 80 à 44 %, flou de 22 px |
| Barre | `.rt-verre-barre` | barre latérale, barre haute ; plus opaque en haut, flou de 38 px |
| Teinté | `.rt-verre-teinte` | un seul élément mis en avant par écran ; voile blanc sur la primaire à 16 % |
| Carte | `--rt-verre-carte` | cartes de tâche, lignes du rétroplanning ; blanc de 92 à 76 % |
| Dépoli | `--rt-verre-depoli` | fenêtres modales, tiroirs, menus, bulles ; blanc de 94 à 86 % |

Aucune surface de verre ne porte de bordure. Un liseré blanc et une ombre d'encre suffisent.

### Surface interne

Un bloc posé dans un panneau (choix, réglage, tuile, ligne cliquable) prend une surface interne. Un fond blanc disparaîtrait sur le verre.

- Le fond est un voile d'encre à 3,5 % (`--rt-surface-interne`), 7 % au survol.
- Un filet d'encre à 10 % dessine le contour (`--rt-bord-interne`).
- Une ombre douce détache le bloc (`--rt-ombre-interne`).
- Un choix actif prend le primaire clair et un filet primaire.

### Rayons, ombres, mouvement

- Rayons : champs 10, puces 14, cartes 20, panneaux 28, barres 36, boutons en pilule.
- Ombres : flottante, verre et verre large, toujours dans la teinte de l'encre du thème.
- Focus : un anneau d'encre à 12 % de 4 px, jamais un bleu vif.
- Mouvement : `cubic-bezier(.32,.72,0,1)`, de 140 à 400 ms, sans rebond. Les animations se coupent quand la personne a réduit les animations.

## États et actions

- **Pastille d'état.** Un point et un libellé sur un fond clair de la même teinte : à faire (encre), en cours (primaire), faite (succès), abandonnée (texte muet), en retard (erreur), alerte (alerte).
- **Boutons.** La primaire en aplat crée et valide. Le verre porte les actions secondaires. Le bouton sans fond porte les actions tertiaires. L'accent est réservé à l'engagement d'une personne.
- **Puces de filtre.** Un groupe exclusif se lit en encre pleine. Une bascule active se lit en primaire clair avec une coche.
- **Étiquette de périmètre.** La couleur du périmètre teinte le fond à 13 %. Le texte reprend cette couleur, assombrie vers l'encre jusqu'à 4,5:1 (`teinteLisible` dans `packages/orga/src/lib/theme.ts`).

## Composants partagés

Les composants de `packages/orga/src/composants` servent aux écrans publics et à l'administration.

| Composant | Rôle |
|---|---|
| `Titre` | en-tête de page : titre, sous-titre, actions à droite, fil d'Ariane au-dessus |
| `DeuxColonnes`, `Panneau`, `Section` | mise en page à deux colonnes, panneau de verre, section titrée avec un compte |
| `Puces`, `PuceBascule`, `SeparateurPuces` | filtres exclusifs et bascules |
| `PastilleEtat`, `PastilleStatut` | états et statut d'une tâche |
| `EtiquettePerimetre`, `PastillePerimetre` | nom d'un périmètre sur sa couleur, teintée ou pleine |
| `Avatar`, `PersonneNommee` | initiales et nom d'une personne, retirable par un admin |
| `ChoixEdition` | sélecteur d'édition |
| `TacheCarte`, `LigneTache` | tâche avec ses actions, tâche sur une ligne sans action |
| `Avancement` | avancement compact ou barre empilée avec sa légende |
| `Recherche`, `MenuCompte`, `Notifications` | éléments de la barre haute |

## Correspondance avec Ant Design 6

| Jeton | Valeur |
|---|---|
| `colorPrimary` | primaire du thème |
| `colorText` | encre |
| `colorTextSecondary` / `colorTextTertiary` | encre à 78 % / 64 % |
| `colorBgLayout` | transparent : le sol est posé sur `html` |
| `colorBgContainer` | blanc à 62 %, verre panneau |
| `colorBorder` | encre à 12 %, filets internes seulement |
| `borderRadius` / `borderRadiusLG` | 10 / 20 |
| `Button.borderRadius` | pilule ; ombre colorée à 28 % sur le bouton primaire |
| `Menu.itemSelectedBg` | encre, texte blanc |
| `Card` | verre panneau, sans bordure |
| `Tag.borderRadiusSM` | pilule |

La configuration complète est construite par `construireTheme` dans `packages/orga/src/lib/theme.ts`.

## Thème d'une organisation

Une organisation déclare son thème dans le bloc `theme` de son `organisation.yaml`. Elle peut changer ses couleurs, ses polices parmi les familles embarquées, la graisse et l'échelle de ses titres, et son fond. La validation (`orga:valider`) refuse une couleur de texte sous 4,5:1, un halo au-delà de 0,35 et une police absente de l'espace organisateur. Le fichier `content/exemple/organisation.yaml` montre un exemple complet.
