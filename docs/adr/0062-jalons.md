# ADR 0062 — Jalons

- **Statut** : acceptée, réalisée
- **Date** : 2026-11-06
- Complète l'ADR 0014 (consultation), l'ADR 0025 (phases), l'ADR 0026 (tâches partagées), l'ADR 0059 (priorités) et l'ADR 0061 (rattachement).
- Ne modifie aucune règle de l'ADR 0026. Une tâche partagée garde au plus une déclinaison par périmètre.

## Contexte

Une tâche ne connaît aujourd'hui qu'un seul lien : la tâche partagée et ses déclinaisons, à raison d'une déclinaison par périmètre (ADR 0026). Une déclinaison est une ligne de la table `Tache`, qui cite sa tâche partagée par `origineId`. L'ADR 0061 permet de rattacher une tâche existante, sans lever la limite d'une déclinaison par périmètre.

Une équipe de coordination veut pourtant suivre l'avancement des autres périmètres sans y être affectée. Une affectation fausse les postes à pourvoir et la charge (ADR 0055). Le 05/11, une activité a rattaché 51 tâches de dix pôles à sept tâches partagées de sa coordination. Chaque pôle mène pourtant plusieurs tâches sur un même sujet, et une seule peut devenir la déclinaison.

Trois besoins se dégagent :

- Une équipe veut poser un objectif à atteindre, et y relier les tâches qui y mènent.
- Une personne veut voir d'un coup d'œil combien de ces tâches restent ouvertes.
- La coordination veut lire ce décompte pour chaque pôle, depuis sa propre tâche.

L'objectif est souvent une vraie tâche, qui achève les tâches qui la précèdent. Un pôle mène par exemple plusieurs tâches « Préparer le parcours », puis la tâche « Envoyer le parcours finalisé ».

La consultation (ADR 0014) ouvre déjà la lecture des tâches de tous les périmètres de l'activité. Le besoin porte donc sur un regroupement et un décompte, et non sur un nouveau droit de lecture.

### Options écartées

- **Plusieurs déclinaisons par périmètre.** L'index unique `(origineId, perimetreId)`, l'import par modèle et la reconduction reposent sur cette règle. L'ADR 0061 a déjà écarté cette voie.
- **Une hiérarchie de sous-tâches**, avec une colonne `parentId` sur la tâche. Une tâche ne servirait alors qu'un seul objectif. La colonne entrerait aussi en conflit avec `origineId`, qui porte déjà un lien à un niveau.
- **Une entité « objectif » distincte de la tâche.** Elle demanderait ses propres droits, ses écrans et son flux. Une tâche porte déjà une échéance, un statut, des personnes assignées, un fil et une place dans les priorités. L'ADR 0026 a écarté une entité nouvelle pour la même raison.
- **Un type de tâche** (`ORDINAIRE`, `JALON`). Un type fige la nature de la tâche à sa création. Un champ facultatif permet de transformer n'importe quelle tâche, puis de revenir en arrière.
- **Un regroupement calculé**, par fiche, par phase ou par filtre enregistré. La liste changerait sans que personne ne l'ait décidé. Une fiche de périmètre ne réunit pas non plus des tâches de plusieurs périmètres.
- **Un statut calculé depuis les tâches liées.** L'ADR 0026 a refusé ce calcul pour la tâche partagée : la personne qui coche reste connue pour le statut vu et pour le score. Un jalon est aussi souvent une tâche à faire après les autres, que personne ne coche à la place de l'équipe.
- **Un lien « bloque » entre deux tâches** (ADR 0059, « Hors de cette décision »). Il demande un sens, une détection des cycles et une transmission d'urgence en chaîne. Le jalon en est un cas restreint : son décompte ne se propage pas, et un cycle reste donc sans effet.

## Décision

### Le jalon

- Un **jalon** est une tâche qui porte le marqueur facultatif « jalon ». Il reste une tâche complète : échéance, statut, personnes assignées, fil, fiche et ajustement.
- Le marqueur est un champ facultatif du modèle `Tache`, et non un type de tâche. Une tâche sans marqueur reste une tâche ordinaire.
- Un jalon peut être une simple vérification : « Toutes les inscriptions sont closes ». Il peut aussi être une action qui achève ses tâches liées et les prolonge : « Envoyer le parcours finalisé ».
- Toute tâche active devient un jalon, à sa création ou plus tard. Le marqueur se pose et se retire sans changer le reste de la tâche.
- Une tâche partagée, une déclinaison acceptée, une tâche ordinaire et une tâche déjà liée se transforment toutes en jalon.
- Seule une déclinaison qui attend un accord, ou refusée, ne se marque pas et ne se lie pas. Elle ne compte pas encore parmi les tâches de son périmètre (ADR 0026).
- Un jalon **lie** d'autres tâches de la même période. Ces tâches sont ses **tâches liées**.
- Une tâche liée appartient au même périmètre que le jalon ou à un autre périmètre de l'activité.
- Une tâche peut servir plusieurs jalons. Un jalon lie au plus 100 tâches.
- Un jalon ne se lie pas à lui-même. Il peut lier un autre jalon.
- Le décompte ne se propage jamais : un jalon lié compte avec son seul statut, sans ses propres tâches liées. Deux jalons qui se lient l'un l'autre ne faussent donc aucun décompte.
- Le marqueur reste visible sur un jalon qui ne lie encore aucune tâche. Une équipe pose ainsi l'objectif avant d'en connaître les étapes.

### Transformer une tâche

- Le formulaire de création d'une tâche propose une case « Jalon ».
- Le menu « Autres actions » d'une carte propose « Transformer en jalon ». Sur un jalon, il propose « Retirer le jalon ».
- La transformation ne change ni le titre, ni l'échéance, ni le statut, ni les personnes assignées, ni la version de la tâche, comme un ajustement (ADR 0059).

### Le décompte

- Un jalon affiche le nombre de tâches liées encore ouvertes, sur le nombre de tâches liées gardées. Exemple : « 3 tâches ouvertes sur 8 ».
- Une tâche ouverte est à faire ou en cours. Une tâche liée abandonnée sort du total et s'affiche à part, comme dans le résumé des déclinaisons.
- Le décompte indique aussi les tâches liées en retard, et celles assignées à la personne qui consulte : « dont 1 vous est assignée ».
- Une tâche liée compte avec son propre statut. Pour une tâche partagée liée, ses déclinaisons ne comptent pas.

### Statut du jalon

- Le statut du jalon reste manuel (ADR 0026).
- Quand toutes les tâches liées gardées sont faites, la carte l'indique. Elle propose de cocher le jalon, ou de le passer en cours quand il reste une action à mener.
- Cocher un jalon dont des tâches liées restent ouvertes demande une confirmation. La fenêtre indique le nombre de tâches ouvertes.
- Un jalon fait ou abandonné garde ses liens. Son décompte reste lisible.
- Rouvrir un jalon ne change aucune tâche liée. Changer le statut d'une tâche liée ne change pas le jalon.

### Retirer un lien ou le marqueur

- Retirer un lien ne change pas la tâche liée.
- Une personne qui écrit dans le périmètre du jalon retire un lien. Une personne qui écrit dans le périmètre de la tâche liée retire aussi le lien de sa tâche.
- Le retrait depuis la tâche liée demande une confirmation. La fenêtre nomme le jalon et son périmètre, et annonce les effets du geste :
  - la tâche sort du décompte du jalon ;
  - le périmètre du jalon ne la suit plus depuis ce jalon ;
  - la tâche perd le point de priorité que le jalon lui donne ;
  - le journal du jalon garde le geste et son auteur.
- Retirer le marqueur d'un jalon qui lie des tâches demande une confirmation. Le geste retire alors tous ses liens.
- Le journal garde chaque geste avec son auteur : marqué, marque retirée, tâche liée, tâche déliée. L'historique des liens se lit sur le jalon, par toute personne qui le consulte.

### Droits

- Marquer une tâche et lier une tâche demandent d'écrire dans le périmètre du jalon. Un admin de l'activité écrit dans tous ses périmètres.
- Lier une tâche d'un autre périmètre demande seulement de consulter ce périmètre (ADR 0014). Le lien ne modifie pas la tâche liée et n'ouvre aucune lecture nouvelle.
- Retirer un lien demande d'écrire dans le périmètre du jalon ou dans celui de la tâche liée.
- Le décompte et la liste des tâches liées se lisent avec la consultation du jalon. Toutes les tâches liées appartiennent à la même activité : qui consulte l'une consulte les autres.
- Une personne seulement rattachée (ADR 0045) ou en découverte (ADR 0012) ne voit ni le décompte ni les liens.
- Une période archivée reste en lecture seule : aucun marqueur et aucun lien ne change.

### Tâche liée

- La carte d'une tâche liée indique les jalons qu'elle sert, avec leur périmètre. L'équipe du périmètre sait ainsi qu'un autre périmètre suit cette tâche.
- Le lien n'envoie aucune notification.
- Un périmètre archivé garde ses tâches liées dans le décompte, avec la mention « archivé ». Aucune tâche d'un périmètre archivé ne se lie.

### Jalons et tâches partagées

- Une déclinaison peut être un jalon. Le périmètre cible y lie alors ses propres tâches sur le sujet.
- Le détail des déclinaisons d'une tâche partagée affiche, pour chaque déclinaison marquée, son décompte. La tâche partagée affiche en plus un total : « 21 tâches ouvertes sur 51 dans les jalons des déclinaisons ».
- La coordination suit ainsi le détail des tâches de chaque pôle sans y être affectée. Chaque pôle choisit les tâches qui mènent à son jalon.
- La fenêtre « Décliner dans d'autres périmètres » propose une case « Marquer les déclinaisons comme jalons ».
- Une coordination peut aussi lier directement les tâches des pôles à son propre jalon. Elle choisit alors seule les tâches suivies, sans passer par une déclinaison.

### Priorités et horizon

- Un jalon entre dans les priorités comme toute tâche, par sa propre échéance ou par un ajustement (ADR 0059).
- Son échéance retenue reste la sienne. Les échéances des tâches liées ne la remplacent pas.
- Deux critères s'ajoutent au score, avec leur raison :

| Critère | Points | Raison |
|---|---|---|
| Jalon dont des tâches liées restent ouvertes | 5 | `JALON` (nombre de tâches ouvertes) |
| Tâche liée à un jalon ouvert dont l'échéance tombe dans l'horizon | 10 | `MENE_A_UN_JALON` (titre du jalon le plus proche) |

- Le second critère ne compte qu'une fois, même pour une tâche qui sert plusieurs jalons. Un jalon transmet ainsi un peu d'urgence à ses tâches, à un seul niveau.
- Le panneau « Priorités » ajoute une section « Jalons avant le prochain point ». Elle liste les jalons ouverts dont l'échéance tombe dans l'horizon, tous périmètres confondus, avec leur décompte.
- Le modèle de message « Priorités » (ADR 0020) reprend cette section.

### Phases et rétroplanning

- Un jalon se range dans une phase par son échéance, comme toute tâche (ADR 0025). Il ne déclare aucune phase.
- Le rétroplanning distingue les jalons par une icône. Un filtre « Jalons seuls » les isole.
- Une phase reste un découpage du temps déclaré par l'activité. Un jalon reste un objectif posé par une équipe. Les deux notions ne se fusionnent pas.

### Reconduction et export

- La reprise des tâches (ADR 0048) reprend le marqueur. Elle recrée un lien quand le jalon et la tâche liée sont repris tous les deux.
- L'export complet d'une organisation écrit le marqueur et la liste des tâches liées, désignées par leur périmètre et leur titre, comme `origine`.
- Une tâche type porte une clé facultative `jalon`, avec la liste des modèles liés (`perimetre/modele`). Une liste vide marque la tâche sans lier aucune tâche.
- Un modèle lié désigne une tâche type d'un périmètre, ou la déclinaison qu'un périmètre cible reçoit d'une tâche partagée.
- La clé `declinaison.jalon`, un booléen, marque les déclinaisons de la tâche type.
- La validation du contenu refuse un modèle lié inconnu, un modèle qui se cite lui-même et une liste de plus de 100 modèles.
- L'import marque la tâche et crée les liens manquants. Il ne retire jamais un lien ni un marqueur, comme il ne déplace jamais une déclinaison (ADR 0026). Il signale un modèle lié absent de la période.
- L'export réécrit les tâches types telles que le contenu les déclare, clé `jalon` comprise. Un lien créé dans l'application reste en base, et l'export complet de l'organisation l'écrit. Une tâche type décrit un modèle commun à toutes les périodes. Un lien relie au contraire deux tâches d'une seule période. Cette règle a été précisée le 2026-11-06, avec le lot 3.

## Conséquences

- Une migration additive ajoute à `Tache` deux colonnes facultatives, nulles par défaut : `jalonLe` (date du marquage) et `jalonParId` (auteur). Une valeur nulle désigne une tâche ordinaire, comme pour `ajustementPriorite`.
- Une migration additive crée la table `LienJalon { id, jalonId, tacheId, creeParId?, createdAt }`, unique sur `(jalonId, tacheId)`, avec un index sur `tacheId`. Cette clé est bornée par le jalon, lui-même rangé dans une période (invariant 18).
- Les deux tâches d'un lien se suppriment en `Restrict`, comme le lien d'origine. Une tâche ne se supprime déjà pas dans l'application.
- L'énumération `TypeJournal` gagne `JALON_MARQUE`, `JALON_RETIRE`, `TACHE_LIEE` et `TACHE_DELIEE`.
- Le contrat GraphQL gagne :
  - l'argument `jalon` de `creerTache`, le champ booléen `jalon` et le résumé `resumeJalon { total, ouvertes, faites, abandonnees, enRetard, assigneesAMoi }`, chargés avec la tâche ;
  - le champ `tachesLiees`, lu par la requête d'une seule tâche, et le champ `jalons` d'une tâche liée ;
  - les mutations `marquerJalon(id, jalon)`, `lierTaches(id, tacheIds)` et `delierTache(id, tacheId)` ;
  - l'argument `jalons` de `declinerTache` et de `creerTache(declinaison:)`.
- Un changement de statut d'une tâche liée émet le signal des périmètres de ses jalons (ADR 0017).
- `lib/priorites.ts` reçoit les deux critères, leurs codes de raison, leur traduction et leurs tests. Les poids se règlent sur les tâches réelles, comme ceux de l'ADR 0059.
- Un jalon donne les mêmes points de score de participation qu'une tâche. Un lien ne donne aucun point. La charge (ADR 0055) ne change pas.
- Le glossaire gagne « jalon » (anglais : milestone) et « tâche liée » (anglais : linked task).

## Revue de sécurité

- `lierTaches` vérifie l'écriture dans le périmètre du jalon avec `exigerEcriture`, lue dans l'organisation active. Chaque tâche liée passe ensuite par `exigerConsultation`.
- `delierTache` accepte l'écriture dans l'un des deux périmètres. Les deux contrôles se lisent dans l'organisation active.
- Une tâche d'une autre période, d'une autre activité ou d'une autre organisation reçoit le même refus qu'une tâche inconnue.
- La liste des tâches liées ne renvoie que des champs déjà ouverts par la consultation : titre, échéance, statut, retard, périmètre et personnes assignées. `clotureePar` et `realisateurs` gardent leur propre garde.
- Un lien verrouille le jalon au début de sa transaction, puis relit son marqueur et son nombre de liens. Deux gestes simultanés ne dépassent donc pas le plafond de 100 liens.
- La liaison relit, sous verrou, que chaque tâche liée reste active. Un retrait du marqueur simultané ne laisse donc aucun lien orphelin.
- Les tests prouvent chaque refus : sans session, en consultation seule pour le marqueur et le lien, depuis une autre organisation, vers une autre période, sur une période archivée, vers une déclinaison en attente, et pour chaque règle du lien.

## Questions tranchées

Quentin a tranché ces questions les 5 et 6 novembre 2026 :

- Le terme retenu est « jalon ».
- Un jalon peut être une action qui achève et prolonge ses tâches liées, et pas seulement une vérification.
- Le périmètre d'une tâche liée retire le lien de sa tâche, après une confirmation qui annonce les effets du geste.
- Le lien n'envoie aucune notification au périmètre de la tâche liée. La carte de la tâche liée suffit.
- Un jalon dont des tâches liées restent ouvertes se coche, après une confirmation qui rappelle le nombre de tâches ouvertes.
- Les deux critères des priorités entrent avec leurs poids de 5 et 10 points. Le jalon transmet son urgence à ses tâches liées dès la première version.
- La clé `jalon` du contenu entre dans la première version, avec la validation, l'import et l'export.

La suite des sept tâches partagées de la coordination d'une activité se décidera après la mise en production des jalons.

## Découpe en lots

| Lot | Contenu | Revue |
|---|---|---|
| 1 | Cette ADR, le glossaire et l'index des ADR | Aucune (documentation) |
| 2 | Migration additive (colonnes, table, valeurs de `TypeJournal`), mutations, champs, refus croisés, journal, signal, export complet, reconduction | Oui |
| 3 | Clé `jalon` du contenu : validation, import (`orga:importer`) et export (`orga:exporter`) | Oui |
| 4 | Critères des priorités, section « Jalons avant le prochain point », modèle de message | Oui |
| 5 | Espace organisateur : case du formulaire, « Transformer en jalon », fenêtre de lien, décompte de la carte, détail, tâches liées et retrait confirmé, case de la fenêtre « Décliner », filtre du rétroplanning | Oui |
| 6 | Mode d'emploi des référentes et référents, notes de version | Aucune (documentation) |

- Le lot 2 touche `packages/server/src/schema/taches.ts`, que la mise à jour du rattachement (ADR 0061) modifie en ce moment. Il commence après la fusion de ce travail.
- Les lots 2 à 4 forment une pile. Chaque étage reçoit sa revue avant sa fusion.
