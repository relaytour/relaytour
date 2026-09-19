# Contenu d'exemple

Ce dossier décrit une organisation fictive, « Les Rencontres de la Vallée », un rassemblement sportif associatif sur un week-end. Il montre la structure que Relaytour attend pour les périmètres, les fiches méthode et les tâches types (ADR 0003). Aucune personne, aucune association ni aucun lieu réel n'y figure.

Le contenu de votre organisation ne vit pas dans ce dépôt. Placez-le dans un dossier à vous, par exemple un dépôt Git privé, et indiquez son chemin :

```bash
yarn workspace @relaytour/server orga:valider /chemin/vers/votre/contenu
yarn workspace @relaytour/server orga:importer --dossier /chemin/vers/votre/contenu --edition 2027
```

Sans argument, les commandes lisent ce dossier d'exemple. La variable `CONTENU_ORGA` fixe un autre dossier par défaut. L'import des tâches exige une édition, créée dans l'espace organisateur ou avec `edition:creer`.

## Structure

```
organisation.yaml             nom, sigle, domaines de mail, contact, thème
perimetres.yaml               sports et pôles
modeles/fiche.md              gabarit commun d'une fiche
fiches/communes/<slug>.md     fiches communes à tous les périmètres
fiches/<perimetre>/<slug>.md  fiches d'un périmètre
taches/<perimetre>.yaml       tâches types d'un périmètre
```

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
  polices: { titre: Hanken Grotesk }       # parmi les polices embarquées
```

La validation refuse une clé inconnue, un thème dont une couleur de texte passe sous 4,5:1 de contraste, une police absente de l'espace organisateur et un contact hors des domaines autorisés. Le thème complet est décrit dans `docs/identite.md` du dépôt de Relaytour.

## Périmètres

```yaml
perimetres:
  - slug: football          # identifiant stable, jamais modifié
    nom: Football
    type: SPORT             # SPORT ou POLE
    couleur: '#8FC9B7'      # facultatif
    ordre: 1
    effectif: 2             # facultatif
```

`effectif` indique le nombre de référentes et de référents souhaité pour chaque édition, de 0 à 50. L'import crée l'effectif d'un périmètre s'il manque et ne le remplace jamais : les admins le modifient ensuite dans la page « Postes à pourvoir ».

## Écrire une fiche

1. Copier `modeles/fiche.md` dans `fiches/<perimetre>/` ou `fiches/communes/`.
2. Nommer le fichier comme son slug : `reserver-le-gymnase.md` pour `slug: reserver-le-gymnase`.
3. Remplir les six sections, dans un style neutre et en écriture inclusive.
4. Écrire les contacts sous forme de rôles. **Aucune adresse mail ni aucun numéro personnel** : la validation refuse le fichier. Les boîtes partagées de votre organisation s'autorisent par la variable `DOMAINES_COURRIEL_AUTORISES` (liste de domaines séparés par des virgules).

## Écrire des tâches types

```yaml
taches:
  - modele: reserver-le-gymnase      # identifiant stable
    titre: Réserver le gymnase
    description: Demande écrite au service des sports.
    echeance: J-180                   # 180 jours avant le premier jour de l'édition
    fiche: reserver-le-gymnase        # facultatif
```

`echeance` accepte `J-<jours>` (avant le premier jour) et `J+<jours>` (après).

## Règles de l'import

- L'import crée les périmètres et les fiches, puis les effectifs et les tâches de l'édition demandée.
- Une fiche modifiée dans l'application n'est jamais remplacée : l'import signale un conflit.
- Un effectif déjà présent pour l'édition n'est jamais remplacé.
- Une tâche déjà importée n'est jamais modifiée.
- L'export (`orga:exporter --dossier …`) écrit les fiches modifiées dans l'application et refuse une fiche qui contient des données personnelles.
