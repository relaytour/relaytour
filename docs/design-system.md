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

## Mobile

Chaque écran reste utilisable sur un téléphone de 375 pixels de large (ADR 0023). Les écrans des référentes et référents sont conçus pour le téléphone. Les écrans d'administration restent utilisables, sans disposition propre.

- **Ruptures.** `md` (768 px) sépare le téléphone du reste : en dessous, le menu passe dans un tiroir et les colonnes s'empilent. `lg` (992 px) sépare les dispositions côte à côte. Un composant lit la rupture par `Grid.useBreakpoint`, une feuille de style par une requête `max-width`.
- **Largeur.** La barre haute et le contenu partagent la même largeur, jusqu'au bord droit de l'écran. Déplié, le volet latéral finit sous le bord droit de la barre. Replié, sa tranche se colle au bord droit de l'écran, comme le rail au bord gauche.
- **Hauteur et bords.** Une hauteur d'écran s'écrit en `dvh`, pas en `vh` : la barre du navigateur mobile change la hauteur visible. Les barres fixes ajoutent les marges `env(safe-area-inset-*)`. Dans l'application installée, un voile dépoli couvre toute la zone sûre du haut : le contenu qui défile ne se lit pas sous l'heure. Un tiroir et un message éphémère commencent sous cette zone.
- **Cibles tactiles.** Une cible mesure au moins 44 px de côté au doigt. La requête `(pointer: coarse)` agrandit les petits boutons sans changer l'écran d'ordinateur.
- **Champs.** Un champ de saisie affiche son texte à 16 px au moins sous `md`. En dessous de cette taille, Safari sur iPhone zoome sur le champ.
- **Survol.** Aucune information et aucune action ne dépendent du seul survol. Une bulle d'aide répète une information visible, ou s'ouvre aussi à l'appui.
- **Fenêtres.** Une fenêtre modale longue ou large occupe tout l'écran sous `md`. Un tiroir ne dépasse jamais la largeur de l'écran.
- **Saisie.** Un champ déclare son type et son `autoComplete` : le téléphone affiche alors le bon clavier et propose le code reçu.
- **Application installée.** Un écran ne suppose pas la barre du navigateur : chaque écran offre un retour par l'interface.

## Volets

L'espace organisateur porte deux volets autour du contenu. Chacun se replie pour lui laisser la place.

- **Volet de navigation.** Déplié, c'est une carte de verre flottante de 248 px. Replié, c'est un rail d'icônes de 64 px, collé au bord gauche de l'écran, sur toute sa hauteur, sans arrondi à gauche. Un bouton passe de l'un à l'autre : déplié, il partage la ligne du nom de l'organisation, pour ne prendre aucune hauteur au menu. Le navigateur retient ce choix. Sans choix, le volet est déplié à partir de 1100 px de large et en rail de 768 à 1099 px. Sous 768 px, il devient un tiroir.
- **Rail.** Une entrée ne garde que son icône, et son libellé s'affiche dans une bulle au survol et au focus. Le titre d'un groupe devient un filet. Le changement d'activité demande de déplier le volet. La barre de défilement du menu disparaît, car elle décalerait les icônes : un fondu en bas signale que le menu continue. Dans le volet déplié, elle reste fine et ne se montre qu'au survol ou au focus.
- **Volet latéral.** Dans un écran à deux colonnes, la colonne de droite se replie en une tranche de 32 px : ses cartes glissent vers la droite et ne montrent plus que leur bord arrondi. Le bouton placé en tête de la colonne, ou un clic sur la tranche, la rouvre. Cet état vaut pour l'écran affiché et ne se retient pas.
- **Volet collant.** Le volet latéral reste dans l'écran pendant le défilement. Plus haut que l'écran, il suit le sens du défilement : son bas se cale en descendant, son haut en remontant. Sous 1100 px, les deux colonnes s'empilent et le volet suit le contenu.
- **Largeur.** La barre haute et le contenu partagent la même largeur : le volet latéral, déplié ou replié, finit sous le bord droit de la barre. Cette largeur suit l'écran jusqu'à 1600 px. Au-delà, l'ensemble est centré dans la place que le volet de navigation laisse.
- **Mouvement.** La largeur, la marge et les arrondis changent ensemble, avec la courbe et la durée du matériau (240 ms).

## Tableaux

Tous les tableaux passent par le composant `Tableau`.

- **Un seul défilement vertical.** Un tableau ne borne pas sa hauteur : la page défile. L'en-tête du tableau reste collé sous la barre haute.
- **Barre de défilement horizontale.** Elle reste collée en bas de l'écran tant que le tableau est visible. La personne n'a pas à descendre jusqu'à la dernière ligne pour faire défiler les colonnes.
- **Colonnes figées.** Le bouton d'ouverture, la case de sélection et la première colonne restent visibles pendant le défilement horizontal. Elles se figent d'office quand le tableau dispose de 900 px. En dessous, elles occuperaient trop de place : une punaise, dans l'en-tête de la première colonne, les fige sur choix. Le navigateur retient ce choix par tableau.
- **Fond plein.** Le verre du tableau est translucide. Une cellule figée et un en-tête collé prennent un fond plein, pour que le contenu ne se lise pas au travers.

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
