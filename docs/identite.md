# Identité par défaut de Relaytour

Décision de Quentin du 18 septembre 2026, après une planche de fondations et un écran type maquettés en trois thèmes.

## Pourquoi

- Relaytour est un logiciel pour toutes les organisations : son identité par défaut ne fait référence à aucun sport ni à aucune association.
- Le thème d'origine venait du site d'une édition d'un rassemblement multisports ; ses droits ne sont pas ceux du projet. Il devient le thème de cette organisation, porté par son propre dépôt (ADR 0006).
- Le matériau visuel (verre, rayons, ombres, mouvement) appartient à Relaytour et reste le même pour toutes les organisations. Une organisation ne fournit que sa palette, ses polices et la typographie de ses titres.
- Une couleur identifie un périmètre, jamais une section : la couleur d'un périmètre vient du contenu de l'organisation et sert de repère (pastille, filet, étiquette).
- Aucune police servie par un tiers : les familles sont embarquées par paquets fontsource, licence OFL.

## Palette par défaut « bleu-vert »

| Rôle | Valeur | Usage |
|---|---|---|
| encre | `#1B2730` | texte, icônes, ombres ; les autres textes sont des transparences de l'encre (84, 78, 64, 38 %) |
| primaire | `#1E5A63` | actions principales, liens, élément de menu actif |
| primaire clair | `#DCEAEB` | état « en cours », en-têtes de tableau |
| accent | `#AD412B` | engagement d'une personne, notification non lue |
| accent clair | `#F6E1DB` | fond des éléments accentués |
| succès | `#3A7042` / `#E3F0E4` | tâche faite |
| alerte | `#8A5A0E` / `#FBF0D8` | échéance proche |
| erreur | `#A23A2C` / `#F8E3DF` | retard ; une brique sourde, jamais un rouge vif |
| sol | `#FFFFFF`, `#F4F6F7`, `#E9EEF0` | dégradé fixe à 138°, bande dense au milieu |

Chaque couleur de texte atteint 4,5:1 sur le blanc, sur la bande dense du sol et sur l'arrêt de transition. Le test `packages/tokens/src/index.test.ts` le vérifie.

Le thème alternatif « encre-lagon » garde la même palette avec les actions en encre (`#1B2730`) et un seul accent lagon (`#136D6C`). Il est livré avec l'application ; une organisation peut le demander tel quel.

## Fond

Le fond d'un thème se compose du dégradé du sol et de deux halos.

- Le dégradé part de `sol1`, passe par l'arrêt de `transition` à 18 %, par `sol2` à 46 %, `sol3` à 60 %, `sol2` à 78 % et revient à `sol1`. L'arrêt de transition permet un blanc crème entre le blanc et la bande claire.
- Les deux halos sont des taches floues et fixes derrière le verre. Chacun a une couleur et une intensité, de 0 à 0,35 : au-delà, un halo gênerait la lecture.
- Une organisation déclare ces valeurs dans le bloc `fond` de son thème. Sans déclaration, la transition reprend `sol1`, le premier halo la primaire à 18 % et le second l'accent à 13 %.
- Le thème par défaut garde un blanc pur à 18 % et ces halos dérivés.

## Hiérarchie du texte

- 100 % pour les titres et le texte principal.
- 84 % pour le texte courant d'une carte, comme la description d'une tâche.
- 78 % pour le texte secondaire (`colorTextSecondary` d'antd).
- 64 % pour le texte muet et les comptes en mono (`colorTextTertiary`).
- 38, 12 et 7 % pour les icônes inactives, les filets et les fonds.

Les gris de texte ont été relevés le 19 septembre 2026. Sur le verre teinté, 52 % descendait à 3,1:1 et 68 % restait peu lisible. Les nouvelles valeurs dépassent 4,5:1 sur toutes les surfaces.

## Polices

- Hanken Grotesk pour l'interface et les titres (graisse 600, espacement −0,02 em).
- IBM Plex Mono pour les dates, les heures, les identifiants et les libellés en capitales espacées.
- Bebas Neue et Quicksand restent embarquées pour un thème d'organisation qui les nomme.
- Casse de phrase partout, aucun titre en capitales.

## Logotype

Le pictogramme est formé de deux arcs qui se passent le relais : le premier en primaire, le second en accent. Il reste lisible à 16 pixels (`packages/orga/public/favicon.svg`). Le nom s'écrit en Hanken Grotesk 600, espacement −0,02 em. Le composant `Marque` affiche le pictogramme et le nom ; le nom viendra de la configuration de l'organisation (ADR 0006).

## Matériau

- Trois verres : panneau (cartes, tableaux, formulaires), barre (barre latérale, barre haute, tiroirs), teinté (élément mis en avant). Aucune bordure : un liseré blanc et une ombre d'encre suffisent.
- Un verre de carte, plus dense (blanc de 92 à 76 %), porte les cartes de tâche et les lignes du rétroplanning. Le sol et les halos ne gênent plus la lecture de leur texte.
- Une surface interne distingue un bloc posé dans un panneau (choix, réglage, tuile, ligne cliquable) : un voile d'encre à 3,5 %, un filet d'encre à 10 % et une ombre douce. Un fond blanc disparaît sur le verre.
- Rayons : champs 10, chips 14, cartes 20, panneaux 28, barres 36, boutons en pilule.
- Ombres diffuses dans la teinte de l'encre du thème. Focus : anneau d'encre à 12 %.
- Mouvement fluide, sans rebond : `cubic-bezier(.32,.72,0,1)`, 140 à 400 ms.

Les valeurs vivent dans `packages/tokens/src/index.ts` (thème) et `packages/orga/src/global.css` (matériau).
