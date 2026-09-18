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
| encre | `#1B2730` | texte, icônes, ombres ; le texte secondaire est une transparence de l'encre (68, 52, 38 %) |
| primaire | `#1E5A63` | actions principales, liens, élément de menu actif |
| primaire clair | `#DCEAEB` | état « en cours », en-têtes de tableau |
| accent | `#AD412B` | engagement d'une personne, notification non lue |
| accent clair | `#F6E1DB` | fond des éléments accentués |
| succès | `#3A7042` / `#E3F0E4` | tâche faite |
| alerte | `#8A5A0E` / `#FBF0D8` | échéance proche |
| erreur | `#A23A2C` / `#F8E3DF` | retard ; une brique sourde, jamais un rouge vif |
| sol | `#FFFFFF`, `#F4F6F7`, `#E9EEF0` | dégradé fixe à 138°, bande dense au milieu |

Chaque couleur de texte atteint 4,5:1 sur le blanc et sur la bande dense du sol. Le test `packages/tokens/src/index.test.ts` le vérifie.

Le thème alternatif « encre-lagon » garde la même palette avec les actions en encre (`#1B2730`) et un seul accent lagon (`#136D6C`). Il est livré avec l'application ; une organisation peut le demander tel quel.

## Polices

- Hanken Grotesk pour l'interface et les titres (graisse 600, espacement −0,02 em).
- IBM Plex Mono pour les dates, les heures, les identifiants et les libellés en capitales espacées.
- Bebas Neue et Quicksand restent embarquées pour un thème d'organisation qui les nomme.
- Casse de phrase partout, aucun titre en capitales.

## Logotype

Le pictogramme est formé de deux arcs qui se passent le relais : le premier en primaire, le second en accent. Il reste lisible à 16 pixels (`packages/orga/public/favicon.svg`). Le nom s'écrit en Hanken Grotesk 600, espacement −0,02 em. Le composant `Marque` affiche le pictogramme et le nom ; le nom viendra de la configuration de l'organisation (ADR 0006).

## Matériau

- Trois verres : panneau (cartes, tableaux, formulaires), barre (barre latérale, barre haute, tiroirs), teinté (élément mis en avant). Aucune bordure : un liseré blanc et une ombre d'encre suffisent.
- Rayons : champs 10, chips 14, cartes 20, panneaux 28, barres 36, boutons en pilule.
- Ombres diffuses dans la teinte de l'encre du thème. Focus : anneau d'encre à 12 %.
- Mouvement fluide, sans rebond : `cubic-bezier(.32,.72,0,1)`, 140 à 400 ms.

Les valeurs vivent dans `packages/tokens/src/index.ts` (thème) et `packages/orga/src/global.css` (matériau).
