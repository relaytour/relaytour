# Contenu d'exemple

Ce dossier décrit une organisation fictive, « Les Rencontres de la Vallée ». Elle porte deux activités : un rassemblement sportif sur un week-end, et un club de course qui vit toute l'année. Le dossier montre la structure que Relaytour attend pour les activités, les périmètres, les fiches méthode et les tâches types (ADR 0003 et 0008). Aucune personne, aucune association ni aucun lieu réel n'y figure.

Le contenu de votre organisation ne vit pas dans ce dépôt. Placez-le dans un dossier à vous, par exemple un dépôt Git privé, et indiquez son chemin :

```bash
yarn workspace @relaytour/server orga:valider /chemin/vers/votre/contenu
yarn workspace @relaytour/server orga:importer --dossier /chemin/vers/votre/contenu --edition 2027
```

Sans argument, les commandes lisent ce dossier d'exemple. La variable `CONTENU_ORGA` fixe un autre dossier par défaut. L'import des tâches exige une période de l'année demandée, créée dans l'espace organisateur ou avec `edition:creer`. Une installation qui porte plusieurs organisations exige `--organisation <slug>`.

## Structure

Un dossier de contenu prend l'une de deux dispositions. Elles ne se mélangent pas.

**Disposition plate**, pour une organisation qui ne mène qu'une activité. Le gabarit `relaytour/organisation-modele` la propose. L'activité reprend le slug et le nom de l'organisation, et ses groupes sont sport et pôle.

```
organisation.yaml             nom, sigle, domaines de mail, contact, thème
perimetres.yaml               périmètres de l'activité
modeles/fiche.md              gabarit commun d'une fiche
fiches/communes/<slug>.md     fiches communes à tous les périmètres
fiches/<perimetre>/<slug>.md  fiches d'un périmètre
taches/<perimetre>.yaml       tâches types d'un périmètre
```

**Disposition `activites/`**, pour plusieurs activités : un événement, une section, une instance. Ce dossier d'exemple la suit.

```
organisation.yaml
modeles/fiche.md
activites/<activite>/activite.yaml     nom, nature, groupes de périmètres
activites/<activite>/perimetres.yaml
activites/<activite>/fiches/…
activites/<activite>/taches/…
```

Le slug d'une fiche est unique dans l'organisation, toutes activités confondues. Une tâche type ne cite qu'une fiche de sa propre activité.

## Activité

```yaml
slug: club-de-course      # identifiant stable, le nom du dossier
nom: Club de course
sigle: Club               # facultatif
nature: SAISON            # EVENEMENT (édition), SAISON (saison) ou MANDAT (mandat)
groupes:                  # facultatif : sport et pôle par défaut
  - cle: groupe
    libelle: Groupe d'entraînement
    libellePluriel: Groupes d'entraînement
  - cle: pole
    libelle: Pôle
    libellePluriel: Pôles
ordre: 2                  # facultatif : ordre d'affichage
```

La nature fixe le mot qui désigne une période : édition pour un événement, saison pour une section, mandat pour une instance. Les échéances des tâches types se comptent depuis le premier jour de la période.

## Organisation

```yaml
slug: rencontres-de-la-vallee   # identifiant stable
nom: Les Rencontres de la Vallée
sigle: Rencontres               # facultatif : nom court affiché dans l'espace organisateur et les mails
fuseauHoraire: Europe/Paris     # facultatif
domainesCourrielAutorises: [exemple.org]   # boîtes partagées admises dans les fiches
contactRecrutement: contact@exemple.org    # facultatif, dans un domaine autorisé
pageEquipe: https://exemple.org/equipe     # facultatif
theme:                          # facultatif : chaque valeur absente prend celle de Relaytour
  couleurs: { primaire: '#1E5A63' }
  fond:                                    # facultatif : sans lui, le fond suit les couleurs
    transition: '#FFFFFF'                  # arrêt à 18 % du dégradé du sol
    halo1: { couleur: '#1E5A63', intensite: 0.18 }   # intensité de 0 à 0,35
    halo2: { couleur: '#AD412B', intensite: 0.13 }
  polices: { titre: Hanken Grotesk }       # parmi les polices embarquées
```

La validation refuse une clé inconnue, un halo dont l'intensité dépasse 0,35, un thème dont une couleur de texte passe sous 4,5:1 de contraste, une police absente de l'espace organisateur et un contact hors des domaines autorisés. Le thème complet est décrit dans `docs/design-system.md` du dépôt de Relaytour.

## Périmètres

```yaml
perimetres:
  - slug: football          # identifiant stable, jamais modifié
    nom: Football
    groupe: sport           # un groupe déclaré par l'activité
    couleur: '#8FC9B7'      # facultatif
    ordre: 1
    effectif: 2             # facultatif
```

Un contenu écrit avant l'ADR 0008 porte `type: SPORT` ou `type: POLE` à la place du groupe : l'import le lit comme le groupe `sport` ou `pole`.

`effectif` indique le nombre de référentes et de référents souhaité pour chaque période, de 0 à 50. L'import crée l'effectif d'un périmètre s'il manque et ne le remplace jamais : les admins le modifient ensuite dans la page « Postes à pourvoir ».

## Écrire une fiche

1. Copier `modeles/fiche.md` dans `fiches/<perimetre>/` ou `fiches/communes/`.
2. Nommer le fichier comme son slug : `reserver-le-gymnase.md` pour `slug: reserver-le-gymnase`.
3. Remplir les six sections, dans un style neutre et en écriture inclusive.
4. Écrire les contacts sous forme de rôles. **Aucune adresse mail ni aucun numéro personnel** : la validation refuse le fichier. Les boîtes partagées de votre organisation s'autorisent par la clé `domainesCourrielAutorises` d'`organisation.yaml`.

## Écrire des tâches types

```yaml
taches:
  - modele: reserver-le-gymnase      # identifiant stable
    titre: Réserver le gymnase
    description: Demande écrite au service des sports.
    echeance: J-180                   # 180 jours avant le premier jour de la période
    fiche: reserver-le-gymnase        # facultatif
```

`echeance` accepte `J-<jours>` (avant le premier jour) et `J+<jours>` (après).

## Règles de l'import

- L'import crée les activités, les périmètres et les fiches, puis les effectifs et les tâches de la période demandée, dans chaque activité qui en a une.
- Une activité, un périmètre ou une fiche absents du dépôt sont signalés, jamais archivés.
- Une activité nouvelle respecte la limite d'activités de l'organisation, s'il y en a une.
- Une fiche modifiée dans l'application n'est jamais remplacée : l'import signale un conflit.
- Un effectif déjà présent pour l'édition n'est jamais remplacé.
- Une tâche déjà importée n'est jamais modifiée.
- L'export (`orga:exporter --dossier …`) écrit les fiches modifiées dans l'application, dans la disposition du dossier. Il refuse une fiche qui contient des données personnelles.
