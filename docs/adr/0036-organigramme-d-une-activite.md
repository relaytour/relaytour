# ADR 0036 — Organigramme d'une activité

- **Statut** : proposée
- **Date** : 2026-10-14
- Complète l'ADR 0011 (contact principal), l'ADR 0012 (page « Tous les périmètres ») et l'ADR 0014 (consultation). Ajoute une règle de lecture des adresses à l'ADR 0018.

## Contexte

Une personne qui rejoint une activité ne sait pas qui fait quoi. Les noms existent dans l'application, mais ils sont dispersés :

- la page d'un périmètre montre ses référentes et référents, avec le contact principal en tête (ADR 0011, 0014) ;
- l'écran « Personnes » et l'écran « Admins » sont réservés aux admins ;
- la page « Tous les périmètres » ne montre aucun nom (ADR 0012).

Les organisations présentent donc leur équipe dans un tableau tenu à côté, souvent avec les adresses de tout le monde. Ce tableau circule sans contrôle et n'est jamais à jour.

Le besoin porte sur deux points : présenter l'équipe d'une activité en une page, et contacter facilement les bonnes personnes.

L'adresse d'une personne est une donnée personnelle. Depuis l'ADR 0018, elle se lit par la personne elle-même, par les admins de l'organisation et par les admins de ses activités. Une personne qui accepte de coordonner un périmètre n'accepte pas pour autant de recevoir les mails de toute l'activité.

Quatre options d'affichage des adresses ont été envisagées pour une activité : personne, le contact principal, tout le monde, l'administrateur de la plateforme. L'administrateur de la plateforme est l'hébergeur de l'installation (ADR 0008). Il n'a pas accès aux données de l'organisation et ne peut pas répondre à une question sur l'équipe. Le contact de l'activité, une adresse de rôle déjà déclarée dans son identité (ADR 0009), répond au même besoin.

## Décision

### La page « Organigramme »

- Chaque activité a une page « Organigramme », dans la section « Périmètres » du menu, après « Tous les périmètres ». Elle est visible dans toute activité que la personne découvre (ADR 0012).
- La page porte sur la période en préparation ou en cours la plus récente, comme la page « Tous les périmètres ».
- Elle présente, dans cet ordre : le contact de l'activité, les admins de l'activité, puis les périmètres rangés par groupe.
- Chaque périmètre montre son nom, sa couleur, son contact principal, puis ses autres référentes et référents de la période, par ordre alphabétique.
- Une personne archivée dans l'organisation (ADR 0031) n'apparaît pas. Un périmètre archivé non plus.
- La page est une lecture seule. Elle ne montre ni tâche, ni souhait, ni demande, ni rôle d'organisation.

### Ce que lit chaque personne

- Une personne qui **voit** l'activité (elle l'administre, ou elle y a été affectée au moins une fois) lit l'organigramme complet : les admins de l'activité, les contacts principaux et les référentes et référents. Ces noms lui sont déjà ouverts par la consultation (ADR 0014).
- Une personne qui **découvre** l'activité sans la voir (souhait, activité ouverte aux souhaits) lit le contact de l'activité, les admins de l'activité et le contact principal de chaque périmètre. Elle ne lit pas les autres référentes et référents. Cette règle remplace, pour cette page seulement, la règle « la page ne montre aucun nom de personne » de l'ADR 0012.
- Le contact de l'activité est une adresse de rôle (`contactRecrutement`, repris de l'organisation à défaut). Il s'affiche toujours quand il existe, puisqu'il ne désigne aucune personne.

### Adresses des personnes : deux accords

Une adresse personnelle s'affiche seulement si le réglage de l'activité et l'accord de la personne l'autorisent tous les deux.

**Le réglage de l'activité** (`Activite.adressesOrganigramme`) fixe l'étendue maximale :

| Valeur | Adresses affichées |
|---|---|
| `AUCUNE` (par défaut) | Aucune adresse personnelle. L'organigramme montre des noms et le contact de l'activité. |
| `CONTACTS` | Les admins de l'activité et les contacts principaux. |
| `REFERENTS` | Les admins de l'activité, les contacts principaux, et toutes les référentes et tous les référents. |

- Seul un admin de l'activité change ce réglage, dans l'écran « Activités ».
- Le réglage vit en base seulement. Il n'entre pas dans le contenu de l'activité : un import ne l'élargit ni ne le restreint jamais. L'export complet d'une organisation le reprend.

**L'accord de la personne** (`Appartenance.adresseVisible`) vaut pour une organisation :

- Il est désactivé par défaut. Aucune adresse existante ne devient visible par cette décision.
- La personne l'active ou le retire dans « Préférences », sous le libellé « Afficher mon adresse dans l'organigramme ». Elle seule le change : aucun admin ne le modifie pour elle.
- L'accord porte sur l'appartenance, et non sur le compte : une personne membre de deux organisations donne son accord à chacune (ADR 0030). Les préférences de notification suivent la même règle (ADR 0032).

**Qui lit ces adresses** : seules les personnes qui voient l'activité. Une personne en découverte ne lit aucune adresse personnelle, quel que soit le réglage. Elle lit le contact de l'activité.

### Contacter

- Chaque adresse affichée porte un lien « Écrire », qui ouvre la messagerie de l'appareil (`mailto:`).
- L'application n'envoie aucun message entre membres et ne garde aucune trace de ce lien. Un relais de messages par le serveur, qui cacherait l'adresse, reste hors de cette décision.

## Conséquences

- Une migration additive ajoute l'énumération `AdressesOrganigramme` et la colonne `Activite.adressesOrganigramme` (`AUCUNE` par défaut), puis la colonne `Appartenance.adresseVisible` (fausse par défaut).
- Une requête `organigramme(activiteId)` sert la page. Le champ `adresse` d'une personne y vaut `null` hors des deux accords. Le contrôle se fait sur le serveur (invariant 1).
- Une mutation `modifierMonAdresseVisible(visible)` règle l'accord de la personne, pour son organisation active. La requête `moi` expose `adresseVisible`.
- `modifierActivite` reçoit `adressesOrganigramme`, réservé aux admins de l'activité.
- Le flux des changements relit l'organigramme sur un signal d'équipe ou de périmètre (ADR 0017).
- La table des refus croisés couvre la requête et la mutation. Les tests prouvent qu'une adresse reste vide sans réglage, sans accord, pour une personne en découverte, et pour une personne d'une autre activité ou d'une autre organisation (invariant 11).
- Les modes d'emploi décrivent la page pour chaque rôle, le réglage pour les admins d'activité et l'accord dans les préférences.
- Le glossaire reçoit le mot « organigramme ».

## Revue de sécurité

- Aucune adresse personnelle ne s'affiche sans l'action de la personne concernée. Le réglage par défaut de l'activité et l'accord par défaut de la personne sont tous deux fermés.
- Le retrait de l'accord prend effet à la lecture suivante. Une adresse déjà copiée ou déjà notée par une autre personne ne se rappelle pas : le texte de l'accord le dit.
- L'organigramme ne révèle pas l'existence d'une personne hors de l'activité. Il ne lit que les affectations de la période et les admins de l'activité, sous le contrôle de visibilité existant (`exigerActiviteDecouverte`).
- Le nom des admins de l'activité devient lisible par les personnes qui découvrent l'activité. Ce nom est la première information utile à une personne qui veut rejoindre l'équipe.
- Une activité d'une autre organisation, ou une activité que la personne ne découvre pas, reçoit le même refus qu'un identifiant inconnu.
