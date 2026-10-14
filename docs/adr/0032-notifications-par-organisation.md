# ADR 0032 — Préférences de notification par organisation et notifications qui nomment leur contexte

- **Statut** : proposée
- **Date** : 2026-10-14
- Complète l'ADR 0008 (une personne, plusieurs organisations), l'ADR 0024 (notifications push) et l'ADR 0031 (archivage par organisation).

## Contexte

Une personne peut appartenir à plusieurs organisations, et à plusieurs activités dans chacune (ADR 0008). Deux défauts gênent alors la lecture de ses notifications.

### Les préférences sont communes à toutes les organisations

`PreferenceNotification` a le compte pour clé. Une personne qui coupe le résumé dans une organisation le coupe dans toutes. La ligne porte aussi une colonne `organisationId`, renseignée avec l'organisation active au premier enregistrement. Le code ne la lit pas, mais sa clé étrangère gênera la suppression de cette organisation. L'audit du cloisonnement d'octobre 2026 l'a relevé (constat C9).

### Les textes ne disent pas toujours de quelle organisation ni de quelle activité ils parlent

L'inventaire des textes, fait sur `develop` le 14 octobre 2026, donne ceci.

| Canal | Ce qui nomme le contexte | Ce qui manque |
|---|---|---|
| Ligne de notification (cloche, push, rappels, résumé) | Le titre de la tâche et le nom de son périmètre, ou le titre de la fiche | L'activité, et la période quand l'activité en a plusieurs d'ouvertes |
| Notification push | Le titre porte le nom court de l'organisation | L'activité |
| Sujet du mail « tâche modifiée » | Rien | L'organisation et l'activité |
| Sujets des autres mails | Le nom court de l'organisation | L'activité, pour un mail qui porte sur une seule activité |
| Rappels et résumé | Une liste unique de lignes | Un regroupement par activité |
| Liens des mails | Le chemin de l'activité et du périmètre | L'organisation : le lien s'ouvre dans l'organisation choisie en dernier sur l'appareil |
| Cloche de l'espace organisateur | Les notifications de l'organisation active | L'activité de chaque ligne, et les nouvelles des autres organisations |

Deux activités peuvent porter chacune un périmètre du même nom, par exemple « Natation » ou « Logistique ». Une ligne comme « Léa a modifié la tâche « Réserver le bassin » (Natation) » ne permet alors pas de savoir où agir. Le défaut des liens est un bogue. Un lien vers un périmètre de l'organisation B s'ouvre dans l'organisation que l'appareil a choisie en dernier. Si c'est l'organisation A, l'activité du lien n'y existe pas. L'espace organisateur sait pourtant lire l'organisation dans l'adresse (`?organisation=<slug>`, ADR 0023), mais les mails ne s'en servent pas.

## Décision

### Les préférences se règlent par organisation

- Une nouvelle table `PreferenceOrganisation` porte les mêmes réglages que `PreferenceNotification`, avec la clé `(userId, organisationId)`. La migration est additive.
- La migration crée une ligne pour chaque appartenance d'un compte qui a déjà une ligne de préférences, avec les valeurs de cette ligne. Personne ne perd donc un réglage.
- Sans ligne, une organisation applique les valeurs par défaut. Une organisation que la personne rejoint ne reprend pas les réglages d'une autre : rien ne passe d'une organisation à l'autre.
- Le serveur lit les préférences de l'organisation concernée : celle du mail, de la notification ou du résumé. Le code de connexion et l'invitation d'une personne qui n'est pas encore membre partent toujours, comme aujourd'hui.
- L'écran « Préférences » règle l'organisation active et le dit dans son titre. L'activation du push reste propre à chaque appareil (ADR 0024) ; les familles de push se règlent par organisation.
- La date du dernier résumé entre dans la nouvelle table. Le champ JSON `derniersResumes` n'est plus écrit.
- `PreferenceNotification` reste en base et n'est plus écrite. Une version antérieure la lit encore après un retour arrière : la personne y retrouve ses réglages d'avant la migration.

### Chaque notification nomme son activité

- Une ligne de notification nomme l'activité de la tâche ou de la fiche : « Léa a modifié la tâche « Réserver le bassin » (Rencontres, Natation). »
- Elle nomme aussi la période quand l'activité a plus d'une période qui n'est pas archivée : « (Rencontres 2027, Natation) ».
- La règle vaut partout où la ligne se lit : cloche, push, rappels et résumé. Une notification sans activité, comme une invitation acceptée, ne change pas.

### Un mail nomme son organisation et son activité

- Chaque sujet commence par le nom court de l'organisation. Un mail qui porte sur une seule activité ajoute son nom : « TIMM · Rencontres : une de vos tâches a été modifiée ».
- Le titre d'une notification push suit la même forme : nom court de l'organisation, puis activité.
- Les rappels et le résumé regroupent leurs lignes par activité, sous un intertitre qui la nomme.

### Un lien désigne son organisation

- Chaque lien d'un mail et d'une notification push porte l'organisation dans son adresse, par le paramètre `organisation` que l'ADR 0023 a introduit.
- À l'ouverture, l'espace organisateur choisit cette organisation, comme il le fait déjà pour l'application installée. Le serveur ignore une organisation dont la personne n'est pas membre active.

### La cloche montre l'activité et les autres organisations

- Chaque ligne de la cloche porte l'étiquette de son activité.
- Le sélecteur d'organisation affiche, pour chaque autre organisation de la personne, le nombre de ses notifications non lues. Ce nombre ne compte que les organisations où la personne est membre active.

## Options écartées

- **Des préférences communes à toutes les organisations** (option A de l'audit). Elles restaient les plus simples, mais une personne ne pouvait pas couper le résumé d'une organisation qu'elle suit de loin.
- **Une répartition mixte**, avec les canaux par personne et la fréquence du résumé par organisation. Elle demandait d'expliquer deux règles pour un seul écran.
- **Des préférences par activité.** Elles multipliaient les réglages pour un gain faible : les nouvelles d'une activité se coupent déjà par le réglage « Activité de vos périmètres ».
- **Un préfixe d'activité seulement pour les personnes de plusieurs activités.** La règle aurait changé le texte d'une notification selon la personne qui la lit, et rendu les captures et les tests plus fragiles.

## Conséquences

- Une migration additive crée la table et reprend les réglages. Elle ne supprime aucune colonne.
- Les textes de notification et les sujets de mail changent pour toutes les installations, y compris celles d'une seule organisation. Les captures des modes d'emploi qui montrent la cloche ou les préférences sont à reprendre.
- Les gabarits des rappels et du résumé gagnent un intertitre par activité.
- Une note de version d'audience `organisateurs` annonce les nouveaux réglages et les nouveaux textes.

## Revue de sécurité

- Les préférences restent lues par la seule personne concernée. Aucun admin ne les lit.
- Le nombre de notifications non lues d'une autre organisation ne révèle rien à une organisation. Seule la personne le lit, pour ses propres organisations.
- Le paramètre `organisation` d'un lien ne donne aucun accès. Le serveur relit l'appartenance à chaque requête, et une organisation dont la personne n'est pas membre active est ignorée.
- Un test prouve le refus : une personne ne lit ni ne modifie les préférences d'une organisation dont elle n'est pas membre. Un second test vérifie que le compteur d'une organisation où elle est archivée ne s'affiche pas.

## Questions ouvertes

1. Le séparateur des sujets : « TIMM · Rencontres : … » ou « [TIMM] Rencontres : … ».
2. Le compteur des autres organisations : dans le sélecteur seulement, ou aussi sur la cloche.
