# ADR 0060 — Événements suivis par une période

- **Statut** : proposée
- **Date** : 2026-11-04
- Complète l'ADR 0037 (agenda et abonnements), l'ADR 0052 (modules) et l'ADR 0008 (export complet de l'organisation).
- Remplace en partie la règle de l'ADR 0010 « Une activité invisible n'existe pas pour la personne. » Seuls le nom d'une activité suivie, le nom de sa période et ses jours deviennent lisibles, dans l'agenda d'une période qui la suit. Le reste de l'ADR 0010 ne change pas.

## Contexte

Une organisation porte plusieurs activités (ADR 0008). Chacune a ses périodes, ses périmètres, ses tâches et son agenda (ADR 0037). Tout est cloisonné par activité : une personne ne lit que les activités où elle a un lien (ADR 0010, 0045).

Certaines activités travaillent pourtant sur d'autres activités. Le cas d'usage qui a motivé cette décision est une commission inclusion. Elle est déclarée comme une activité de nature `MANDAT`, avec une période « Mandat 2026-2027 ». Elle intervient sur plusieurs événements de l'organisation, chacun déclaré comme une activité de nature `EVENEMENT`. Elle veut piloter sa mission sur l'année.

Aujourd'hui, l'agenda du mandat ne montre que ses propres repères. Les membres de la commission ne voient pas quand ont lieu les événements sur lesquels ils interviennent. Trois contournements existent, et aucun ne convient :

- Affecter les membres de la commission à un périmètre de chaque événement. L'affectation ouvre la consultation de tous les périmètres de l'événement (ADR 0014). Elle ouvre aussi ses fiches communes, son programme et son agenda global.
- Recopier les dates des événements en dates clés du mandat. Une date modifiée dans l'événement reste fausse dans le mandat.
- Transmettre à la commission l'abonnement iCalendar d'activité de chaque événement. L'adresse sort de l'application, et elle sert aussi les réunions globales de l'événement.

La démarche retenue compte trois temps :

- **Piste A.** Chaque événement crée un périmètre « Inclusion ». Les membres de la commission y sont affectés comme référentes et référents. Cette piste ne demande aucun développement et reste possible dès aujourd'hui.
- **Piste B.** La période du mandat suit des périodes d'autres activités. Son agenda affiche leurs jours et leurs dates clés en lecture seule. Cette décision traite la piste B.
- **Piste C.** Une tâche du mandat se décline dans un périmètre d'un événement. Cette piste est seulement cadrée, dans la section « Suite envisagée » ci-dessous.

### Options écartées

- **Un agenda de l'organisation**, qui réunirait les repères de toutes les activités pour tous les membres. Il contredit les ADR 0010 et 0045 : une personne ne voit que les activités auxquelles elle participe.
- **Une copie des dates clés** de l'activité suivie dans la période qui suit. Une copie ne suit pas les modifications de l'original et double les écritures.
- **Le suivi d'une activité entière**, qui inclurait d'office ses périodes futures. Le mandat ne choisirait plus ce qu'il affiche. Une activité qui crée une période la rendrait visible ailleurs sans le savoir.
- **Un suivi soumis à l'accord de l'activité suivie**, proposé par un admin de l'activité qui suit. Pour proposer, cet admin devrait lire la liste des activités et des périodes qu'il ne voit pas. L'ADR 0010 l'interdit. Le retrait par l'activité suivie, décrit plus bas, donne à ses admins le même contrôle.
- **L'affichage des réunions globales et des phases** de l'activité suivie. Une réunion porte un lieu, un lien de visio et une description réservés à l'équipe de l'activité (ADR 0037). Les phases occupent plusieurs semaines et n'ont pas de sens hors de l'activité qui les déclare.

## Décision

### Le suivi

- Un **suivi** lie une période, dite période qui suit, à une période d'une autre activité de la même organisation, dite **période suivie**.
- La table `SuiviPeriode { id, organisationId, editionId, editionSuivieId, creeParId?, createdAt }` porte le lien. Elle est unique sur `(editionId, editionSuivieId)`. Cette clé est bornée par la période qui suit (invariant 18).
- La période suivie appartient à une autre activité que la période qui suit. Les deux activités appartiennent à la même organisation.
- La nature des deux activités ne compte pas. Un mandat suit des éditions, et une saison peut aussi suivre un événement.
- La période suivie n'est pas archivée au moment du suivi. Ses jours se placent dans les deux ans qui entourent la période qui suit, comme une date clé (ADR 0037).
- Une période suit 50 périodes au plus.
- Un suivi n'ouvre aucun droit sur le contenu de l'activité suivie : ni périmètre, ni tâche, ni fiche, ni réunion, ni programme, ni personne. Il ne fait entrer personne dans l'équipe de l'activité suivie (ADR 0018, 0045).

### Qui crée et retire un suivi

- Un admin de l'organisation crée un suivi entre deux périodes de son organisation.
- Une personne qui administre les deux activités crée aussi un suivi entre leurs périodes. Elle voit déjà les deux activités : le suivi ne lui apprend rien.
- Un admin de la seule activité qui suit ne crée pas de suivi. Il ne voit pas les autres activités (ADR 0010). La requête qui liste les périodes à suivre ne lui renvoie que les périodes des activités qu'il administre.
- Un suivi se retire par un admin de l'organisation, par un admin de l'activité qui suit et par un admin de l'activité suivie. Le retrait par l'activité suivie lui laisse le contrôle de ce qu'elle diffuse.
- Les admins de l'activité suivie lisent la liste des périodes qui suivent les leurs, avec le nom de chaque activité et de chaque période. Ils reçoivent une notification dans l'application à la création d'un suivi, sans mail (ADR 0033).
- Une période archivée, qu'elle suive ou soit suivie, ne reçoit plus de nouveau suivi. Les suivis existants restent.
- Une organisation en lecture seule ne crée ni ne retire de suivi (ADR 0008).
- Le journal garde la création et le retrait de chaque suivi. Les admins des deux activités lisent cet historique.

### Ce que montre l'agenda de la période qui suit

- L'agenda de la période qui suit gagne deux sortes d'éléments, en lecture seule :
  - `PERIODE_SUIVIE` : la période suivie, du premier au dernier jour, avec le nom de son activité et le nom de la période ;
  - `DATE_CLE_SUIVIE` : chaque date clé de la période suivie, avec son titre, ses jours et le nom de l'activité suivie.
- Ces éléments se lisent depuis la base à chaque requête. Une date modifiée dans l'activité suivie change aussitôt dans l'agenda qui la suit.
- Le flux des changements (ADR 0017) publie le signal `AGENDA` aux activités qui suivent une période, quand ses jours ou ses dates clés changent.
- La description d'une date clé suivie ne s'affiche pas. Elle est écrite pour l'équipe de l'activité suivie, et peut contenir des informations internes.
- Le nom de la personne qui a créé une date clé ne s'affiche jamais.
- L'écran « Agenda » distingue ces éléments par une couleur et par le nom de l'activité suivie. Ils ne proposent ni modification, ni annulation.

### Ce que voit une personne qui ne voit pas l'activité suivie

- Toute personne qui voit l'activité qui suit lit son agenda global (ADR 0037), et donc les éléments suivis.
- Une personne qui ne voit pas l'activité suivie lit le nom de l'activité, le nom de la période, ses jours, et le titre et les jours de ses dates clés. Elle ne lit rien d'autre.
- Elle ne reçoit aucun lien vers l'activité suivie. Une adresse directe vers cette activité reste refusée comme une activité d'une autre organisation (ADR 0010).
- Une personne qui voit aussi l'activité suivie reçoit un lien vers l'agenda de la période suivie, quand le module `AGENDA` y est actif.
- Une personne en découverte (ADR 0012, 0045) ne lit pas l'agenda de l'activité qui suit. Elle ne lit donc aucun élément suivi.
- La personne qui crée le suivi décide de cette diffusion. L'écran de création indique ce que les personnes de l'activité qui suit liront.

### Archivage

- **Période suivie archivée.** L'écran « Agenda » de la période qui suit continue d'afficher ses jours et ses dates clés, avec la mention « période archivée ». Le mandat garde ainsi la trace des événements de son année. Les abonnements ne servent plus ces éléments, comme ils ne servent déjà plus les repères d'une période archivée.
- **Période qui suit archivée.** Son agenda passe en lecture seule (ADR 0037). Ses suivis restent en base et s'affichent toujours. Ils ne se créent ni ne se retirent plus, sauf le retrait par un admin de l'activité suivie.
- **Activité suivie archivée.** Ses éléments disparaissent de l'agenda et des abonnements de la période qui suit. Le suivi reste en base et dans l'export. La liste des suivis l'indique avec la mention « activité archivée », et ses admins peuvent le retirer.
- **Activité qui suit archivée.** Son agenda ne se lit plus. Les admins de l'activité suivie lisent encore le suivi dans leur liste, avec la mention « activité archivée », et peuvent le retirer.

### Module `AGENDA`

- **Module inactif dans l'activité qui suit.** L'écran « Agenda » n'existe pas (ADR 0052). Aucun élément suivi ne s'affiche ni ne se sert. La création et le retrait d'un suivi depuis cette activité répondent `MODULE_INACTIF`. Les suivis restent en base et réapparaissent à la réactivation.
- **Module inactif dans l'activité suivie.** Ses dates clés appartiennent au module et ne s'affichent plus dans l'agenda qui suit. Le premier et le dernier jour de la période restent affichés : ils appartiennent à la période, pas au module. Le retrait d'un suivi par les admins de l'activité suivie reste possible, depuis l'écran « Éditions ».
- Les deux activités appartiennent à la même organisation. La restriction `Organisation.modulesAutorises` de l'hébergeur s'applique donc des deux côtés à la fois.

### Abonnements iCalendar

- Les abonnements d'activité et les abonnements personnels gagnent un quatrième type d'événements, à côté des trois cases ajoutées le 30 octobre 2026 : « Événements suivis ». La colonne `AbonnementAgenda.inclureSuivis` le porte.
- La case est cochée à la création d'un abonnement. Les abonnements existants reçoivent la valeur de leur case « Dates clés et jours de la période » : ils servaient déjà les repères de leurs périodes.
- Un abonnement d'activité sert les éléments suivis des périodes non archivées de l'activité, dans la fenêtre habituelle de 90 jours en arrière et 540 jours en avant.
- Un abonnement personnel sert les éléments suivis des activités dont la personne a choisi l'agenda global. Le serveur vérifie ses droits à chaque lecture, comme pour le reste de l'abonnement.
- Un élément suivi porte un identifiant iCalendar propre au suivi (`suivi-<suivi>-periode-<période>`, `suivi-<suivi>-date-cle-<date clé>`). Il ne reprend pas l'identifiant de l'élément original. Un agenda abonné à la fois à l'activité qui suit et à l'activité suivie ne confond donc pas les deux événements.
- Un abonnement personnel n'ajoute pas un élément suivi que la personne reçoit déjà de l'activité suivie elle-même. Elle ne voit ainsi pas deux fois le même jour.
- Le titre d'un élément suivi commence par le nom de l'activité suivie : « Fête du sport · Premier jour ».
- La description d'une date clé suivie ne sort pas plus dans un abonnement que dans l'écran.

### Contenu et exports

- Un suivi est une donnée de la base, comme une date clé. L'import et l'export du contenu (`orga:importer`, `orga:exporter`) n'y touchent jamais. Le contenu décrit une activité seule, et `orga:importer --activite` importe une activité à la fois : un suivi désignerait une période qui n'existe peut-être pas encore.
- La reprise des tâches d'une période (ADR 0048) ne reprend pas les suivis. Le mandat suivant suit d'autres éditions, que ses admins choisissent.
- L'export complet de l'organisation (ADR 0008) gagne une liste `suivis`. Chaque entrée désigne la période qui suit et la période suivie par le slug de leur activité et l'année de la période, comme les dates clés. Elle porte aussi l'adresse de la personne qui a créé le suivi et la date de création.
- Un suivi ne compte dans aucune limite (ADR 0008). Il ne crée ni activité, ni période.

## Conséquences

- Une migration additive crée la table `SuiviPeriode`, avec `organisationId`, et la colonne `AbonnementAgenda.inclureSuivis`, remplie depuis `inclureDatesCles`.
- Le contrat GraphQL gagne :
  - la requête `periodesASuivre(editionId)`, qui liste les périodes que la personne peut suivre ;
  - les champs `Edition.suivis` et `Edition.suiviePar`, ce dernier réservé aux admins de l'activité suivie ;
  - les mutations `suivrePeriode(editionId, editionSuivieId)` et `retirerSuivi(suiviId)` ;
  - les sortes `PERIODE_SUIVIE` et `DATE_CLE_SUIVIE` de `ElementAgenda`, avec le nom de l'activité suivie et un lien nul pour qui ne la voit pas ;
  - l'argument `inclureSuivis` des abonnements.
- `evenementsActivite` et `evenementsPersonnels` (`packages/server/src/lib/abonnements-agenda.ts`) lisent les suivis des périodes servies.
- L'écran « Éditions » liste les suivis de chaque période et les périodes qui la suivent.
- La table des refus croisés couvre chaque requête et chaque mutation nouvelle : sans session, depuis une autre organisation, par l'admin d'une seule des deux activités, par une référente, sur une période archivée, avec le module inactif (invariant 11). Un test prouve qu'une personne qui ne voit pas l'activité suivie reçoit un lien nul et aucune description.
- Le glossaire gagne « suivi » et « période suivie ».
- Le mode d'emploi de l'admin de l'organisation décrit le suivi. Celui de l'admin d'activité décrit le retrait depuis l'activité suivie.
- La piste A reste valable. Une organisation peut combiner un périmètre « Inclusion » dans chaque événement et un suivi de ces événements par le mandat.

## Revue de sécurité

- Le suivi est la seule exception à la règle « une activité invisible n'existe pas ». Il révèle le nom de l'activité suivie, le nom de sa période, ses jours, et le titre et les jours de ses dates clés. Il ne révèle aucune personne, aucune description et aucun lieu.
- La diffusion est décidée par une personne qui voit déjà les deux activités : un admin de l'organisation, ou un admin des deux activités. Un admin d'une seule activité ne peut ni lister ni désigner une période qu'il ne voit pas.
- `suivrePeriode` refuse une période d'une autre organisation, une période d'une activité que la personne n'administre pas et une période de la même activité. Le refus est le même que pour un identifiant inconnu.
- Les admins de l'activité suivie sont prévenus et retirent le suivi d'un geste. Le retrait prend effet à la lecture suivante de l'agenda et des abonnements.
- Un titre de date clé est un texte libre, désormais lu hors de son activité quand la période est suivie. Le mode d'emploi rappelle de ne pas y écrire de coordonnée personnelle, comme pour la description d'une tâche (ADR 0014).
- Une adresse d'abonnement qui fuit livre aussi les éléments suivis. Ils ne contiennent aucune donnée personnelle.

## Suite envisagée : tâches inter-activités

Cette section cadre la piste C. Elle ne décide rien. Une ADR ultérieure tranchera chaque question, après l'usage des suivis.

La piste C prolonge l'ADR 0026 à un périmètre d'une autre activité. Une tâche du mandat, par exemple « Vérifier l'accessibilité du site », se déclinerait dans le périmètre « Logistique » de chaque événement suivi. Chaque déclinaison attendrait l'accord du périmètre cible, comme aujourd'hui dans une même activité.

Chaque question ci-dessous liste les options et donne une recommandation.

### Lien entre les deux périodes

- **Options.** (a) Une déclinaison vise tout périmètre de l'organisation. (b) Une déclinaison ne vise qu'un périmètre d'une période suivie par la période d'origine.
- **Recommandation : (b).** Le suivi devient l'autorisation préalable : une personne qui voit les deux activités l'a créé. La validité d'un suivi comme autorisation ne dépendrait pas du module `AGENDA`, qui ne règle que son affichage.

### Référentiel de l'échéance

- **Options.** (a) L'échéance de la déclinaison se compte depuis le premier jour de la période cible (`J-30` de l'événement). (b) Elle se compte depuis le premier jour de la période d'origine (`J+200` du mandat). (c) Elle est une date absolue.
- **Recommandation : (a).** La déclinaison vit dans le périmètre cible, avec ses rappels et son rétroplanning. Le côté origine affiche chaque déclinaison avec sa date absolue, calculée depuis la période cible. Un contenu qui déclare la déclinaison écrit donc `J-n` relatif à l'événement. La tâche d'origine garde sa propre échéance, relative au mandat.

### Droits croisés

- **Options.** (a) Le côté origine lit l'état de chaque déclinaison : titre, statut, échéance, nom du périmètre et de l'activité cibles. (b) Le côté origine consulte la déclinaison entière, avec ses personnes assignées et ses commentaires. (c) Les personnes de l'origine sont rattachées d'office à l'activité cible.
- **Recommandation : (a).** La consultation d'un périmètre suppose de voir son activité (ADR 0014). Le côté origine ne la voit pas. L'état suffit à piloter la mission, sans révéler de personne. Le côté cible lit la tâche d'origine (titre, description) et le nom de l'activité d'origine, sans consulter son périmètre.

### Fiche citée

- **Options.** (a) La déclinaison cite une fiche commune de l'activité cible, comme aujourd'hui (ADR 0026). (b) Elle cite une fiche de l'activité d'origine, ouverte en lecture par la seule déclinaison. (c) Elle cite une **fiche d'organisation**, lisible par tous les membres de l'organisation.
- **Recommandation : (c).** L'ADR 0008 garde `Fiche.slug` unique par organisation pour laisser la place à des fiches d'organisation. L'ADR 0010 en décrit le principe sans le réaliser. Une commission inclusion écrit justement des méthodes qui valent pour tous les événements. Ce premier usage demande sa propre décision : `Fiche.activiteId` facultatif, une place dans le contenu hors de `activites/`, et des droits de rédaction à clé d'organisation (ADR 0008). L'option (b) créerait une exception de lecture fiche par fiche, difficile à prouver.

### Cycles de vie différents

- **Options pour une période cible archivée alors que le mandat continue.** (a) La déclinaison se fige, et le côté origine garde son dernier état avec la mention « période archivée ». (b) La déclinaison sort du compte de la tâche d'origine.
- **Options pour un mandat archivé alors que l'événement continue.** (a) La déclinaison continue de vivre dans le périmètre cible, et le lien reste en lecture seule côté origine. (b) La déclinaison est abandonnée d'office.
- **Recommandation : (a) dans les deux cas.** Une déclinaison appartient à son périmètre cible, qui décide de son sort (ADR 0026). Le compte du mandat indique les déclinaisons restées à faire à l'archivage. La reprise des tâches du mandat suivant ne reprendrait pas les déclinaisons inter-activités : les périodes cibles changent, et l'admin les propose de nouveau.

### Qui peut imposer une déclinaison

- **Options.** (a) Seul un admin de l'organisation impose. (b) Un admin de l'activité d'origine impose. (c) Personne n'impose : chaque déclinaison attend l'accord du périmètre cible.
- **Recommandation : (a).** Dans une même activité, l'admin de l'activité impose parce qu'il administre les deux périmètres (ADR 0026). Entre deux activités, seul l'admin de l'organisation a autorité sur les deux. Un admin de l'activité d'origine propose seulement. Un admin de l'activité cible accepte, comme une personne qui écrit dans le périmètre cible.

### Score et avancement consolidé

- **Options.** (a) Chaque déclinaison compte dans l'avancement de son périmètre cible et dans le score de sa période, et la tâche d'origine affiche un compte (« 3 faites sur 5 »). (b) Un écran du mandat consolide l'avancement par activité cible.
- **Recommandation : (a) d'abord.** Elle reprend la règle de l'ADR 0026 sans calcul nouveau. Une déclinaison ne donne aucun point de création. Sa réalisation compte dans le classement de la période cible, pas dans celui du mandat. L'option (b) se décidera après l'usage du compte.

### Modules

- **Options.** (a) Les tâches inter-activités appartiennent au cœur, toujours actif. (b) Un nouveau module les active, côté origine.
- **Recommandation : (a).** Les tâches et les déclinaisons sont le cœur de l'application (ADR 0052). Un module côté origine laisserait le côté cible sans réglage, alors qu'il reçoit les déclinaisons. Le module `AGENDA` ne conditionnerait que l'affichage du suivi, pas son rôle d'autorisation.

### Limites et facturation

- **Options.** (a) Aucune limite nouvelle : une tâche inter-activités ne crée ni activité ni période. (b) Une limite propre au nombre de suivis ou de déclinaisons inter-activités.
- **Recommandation : (a).** La commission est une activité, et son mandat une période : ils comptent déjà dans `limites.activites` et `limites.periodesOuvertes` (ADR 0008). Une organisation dont la limite d'activités est atteinte garde la piste A, sans activité nouvelle. Les offres et les tarifs restent chez chaque hébergeur, hors du dépôt (ADR 0007).

### Option écartée : un périmètre d'organisation transverse

Un périmètre rattaché à l'organisation plutôt qu'à une activité porterait la commission dans tous les événements. Cette option est écartée. Elle casserait l'invariant « un périmètre appartient à une activité » (`Perimetre.activiteId` obligatoire, ADR 0008), sur lequel reposent trois mécanismes :

- **Les droits.** `exigerAdminDe` déduit l'activité du périmètre. La consultation et la visibilité se calculent par activité (ADR 0010, 0014). Un périmètre sans activité n'aurait pas d'admin d'activité ni de règle de lecture.
- **L'import.** Un périmètre se déclare dans le `perimetres.yaml` de son activité, avec un slug unique par activité et un groupe de cette activité (ADR 0008).
- **L'organigramme.** Il présente l'équipe d'une activité, périmètre par périmètre (ADR 0036).
