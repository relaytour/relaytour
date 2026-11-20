# ADR 0070 — Garde d'état des décisions de candidature

- **Statut** : acceptée
- **Date** : 2026-11-20
- Acceptée le 2026-11-20 : le statut vu sur les deux acceptations et la remise en attente d'un choix refusé, avec un statut recalculé comme au dépôt. Les autres options figurent sous « Options écartées ». La mise en œuvre viendra dans une PR séparée.
- Complète l'ADR 0041 (appels à bénévoles, candidatures et répartition) et l'ADR 0067 (autorisation d'applications tierces).
- Ne remplace aucune règle d'une ADR acceptée. Un appel sans le nouvel argument garde le comportement actuel.

## Contexte

L'équipe traite une candidature séquence par séquence (ADR 0041). Chaque choix d'une séquence passe de « en attente » ou « en liste d'attente » à « accepté » ou « refusé ». Quatre mutations décident :

- `accepterChoixCandidature` accepte un choix. La fiche bénévole naît ou se rattache, et elle reçoit une place à confirmer.
- `placerBenevole`, dans la vue « Répartition », accepte une candidature sur une séquence. Le choix est créé s'il n'existait pas.
- `refuserChoixCandidature` refuse un choix en attente.
- `refuserCandidature` refuse tous les choix en attente et clôt la candidature.

Les deux refus vérifient déjà l'état dans l'écriture. Un refus ne remplace jamais une acceptation validée entre-temps : le serveur répond une erreur de saisie.

Les deux acceptations ne font pas cette vérification. `accepterChoixCandidature` ne s'arrête que sur un choix déjà accepté. Elle accepte un choix refusé sans le signaler. `placerBenevole` accepte une candidature quel que soit le statut de son choix. Dans les deux cas, `annoncerPlace` peut envoyer à la personne candidate le mail de sa première place.

Une décision se prend souvent sur une liste relue plus tôt. C'est le cas d'une personne qui trie les candidatures pendant qu'une autre personne de l'équipe fait de même. C'est aussi le cas d'une application autorisée (ADR 0067) qui lit les candidatures, prépare une proposition, puis l'applique après l'accord de la personne. Entre la lecture et l'écriture, une autre personne peut avoir refusé le choix. L'acceptation écrase alors ce refus et prévient la personne candidate.

Aucune mutation ne remet un choix refusé en attente. Un refus par erreur ne se défait que par une acceptation, qui peut envoyer un mail. Une équipe qui veut seulement revenir sur un refus n'a donc aucun geste sans effet vers l'extérieur.

Les tâches ont déjà réglé ce problème. `changerStatutTache` reçoit le statut vu (`statutAttendu`). Le serveur refuse de changer un statut qu'une autre personne a modifié entre-temps, avec le code `CONFLIT_VERSION` (`packages/server/src/schema/taches.ts`).

## Décision

### Le statut vu sur les acceptations

- `accepterChoixCandidature` reçoit un argument facultatif `statutAttendu: StatutChoix`.
- `placerBenevole` reçoit le même argument. Il désigne le statut du choix de la candidature sur la séquence visée.
- Avec `statutAttendu`, le serveur compare ce statut au statut courant du choix. Un écart répond `CONFLIT_VERSION`, avec l'extension `statutCourant`, comme `changerStatutTache`.
- La comparaison se fait sous les verrous de la candidature et de la séquence, dans la transaction qui accepte. Deux décisions simultanées ne peuvent donc pas passer toutes les deux.
- Un choix déjà accepté rend la candidature sans erreur ni écriture, quel que soit `statutAttendu`. Le serveur le vérifie sous les verrous, avant la comparaison. Cette règle suit `changerStatutTache`, où demander le statut déjà en place ne change rien.
- Deux acceptations simultanées du même choix reçoivent donc toutes les deux la candidature acceptée. Une seule place est créée, et `annoncerPlace` ne part qu'une fois.
- Pour `placerBenevole`, une candidature sans choix sur la séquence a pour statut courant « aucun ». Un `statutAttendu` fourni répond alors `CONFLIT_VERSION`, avec `statutCourant` nul. Une application qui place une candidature sur une séquence non choisie omet l'argument.
- Le conflit est vérifié avant toute écriture et avant `annoncerPlace`. Aucun mail ne part après un conflit.
- Sans `statutAttendu`, le comportement actuel reste le même. Les écrans actuels et les scripts existants continuent de fonctionner.
- L'espace organisateur envoie le statut affiché à chaque acceptation. Un conflit propose de recharger la candidature, comme pour une tâche.

### La remise en attente d'un choix refusé

- Une nouvelle mutation `remettreChoixEnAttente(id, statutAttendu)` remet un choix refusé en attente.
- Elle demande les mêmes droits que `accepterChoixCandidature` : écrire la séquence, avec le module « Bénévoles » actif. Une candidature retirée par la personne candidate ne se modifie pas.
- Elle ne traite qu'un choix refusé. Un choix dans un autre statut répond `CONFLIT_VERSION`, avec `statutCourant`. Le `statutAttendu` est facultatif et ne peut valoir que `REFUSE`.
- La mutation prend les verrous dans l'ordre commun à tout traitement d'une candidature : la candidature, puis la séquence (`accepterSurSequence`).
- Sous ces verrous, l'écriture vérifie de nouveau que le choix est refusé. Un choix accepté entre-temps n'est pas remis en attente, et la mutation répond `CONFLIT_VERSION`.
- Le choix reprend le statut qu'il aurait reçu au dépôt à ce moment : « en attente » tant que les renforts de la séquence restent sous son besoin, « en liste d'attente » sinon (`statutAuDepot`). Les renforts se lisent sous le verrou de la séquence, après toute acceptation concurrente.
- `traiteParId` et `traiteLe` reviennent à null, comme pour un choix jamais traité.
- Une candidature close par ce refus redevient « en attente ». Son adresse en attente (`courrielEnAttente`) reprend la valeur qu'elle avait au dépôt ou à l'import.
- Cette valeur est l'adresse de la candidature pour un dépôt en ligne et pour une ligne importée sans identifiant externe.
- Elle reste nulle pour une ligne importée avec un identifiant externe, car l'adresse d'un acheteur peut couvrir plusieurs billets (ADR 0042). Elle reste nulle aussi pour une candidature sans adresse.
- Quand l'adresse en attente n'est pas nulle, une autre candidature de la même adresse peut attendre sur le même appel. La remise en attente répond alors une erreur de saisie et ne change rien. L'équipe traite d'abord l'autre candidature.
- La candidature est ensuite recalculée (`recalculerCandidature`), comme après un refus.
- Aucun mail ne part. La personne candidate n'a jamais appris le refus, puisque le refus n'envoie rien (ADR 0041).
- La mutation publie le signal de la candidature, comme un refus.
- Les fiches, les places et les plages ne changent pas. Un refus n'en a créé aucune.

### Ce qui reste hors de cette décision

- Le retrait d'une place acceptée se fait toujours depuis le programme. Une acceptation ne se transforme pas en attente par cette mutation.
- Les refus gardent leur garde actuelle. Un argument `statutAttendu` sur les refus n'apporte rien de plus, car un refus ne part que d'un choix en attente.

### Raisons du choix

- Le statut vu reprend un mécanisme déjà connu de l'API et de l'espace organisateur. Une application qui gère les tâches le gère déjà.
- L'argument facultatif ne casse aucun client. L'espace organisateur l'adopte, et le comportement sans argument reste documenté.
- La remise en attente défait un refus sans effet vers l'extérieur. Elle rend une erreur de tri réparable.
- Le statut recalculé au moment de la remise en attente ne demande aucune colonne. Il reflète l'état actuel de la séquence, qui a pu changer depuis le dépôt.

## Options écartées

### Garder le statut d'avant le refus

- Le choix garderait dans une nouvelle colonne son statut d'avant le refus, puis le reprendrait.
- Cette option demande une migration et une valeur à reprendre pour les refus existants.
- Le statut d'avant le refus peut être faux au moment de la remise en attente. Une séquence en liste d'attente au dépôt peut avoir trouvé de la place depuis.

### Toujours remettre en « en attente »

- Le choix reviendrait en « en attente », quel que soit l'état de la séquence.
- Un choix remis en attente passerait devant des choix restés en liste d'attente sur une séquence complète. La liste d'attente perdrait son sens.

### Refuser toute acceptation d'un choix refusé

- Le serveur refuserait d'accepter un choix refusé, avec ou sans argument.
- Cette option change le comportement des clients actuels. Un refus deviendrait définitif tant qu'aucune remise en attente n'existe.
- Le statut vu règle le même risque sans retirer à l'équipe le droit d'accepter, en connaissance de cause, un choix qu'elle a refusé.

## Conséquences

- Aucune migration. Les mutations et l'argument sont additifs.
- Le contrat GraphQL gagne l'argument sur deux mutations et une mutation nouvelle. `yarn codegen` régénère les contrats.
- L'écran d'une candidature affiche un bouton « Remettre en attente » à côté d'un choix refusé, pour les personnes qui écrivent la séquence.
- Le mode d'emploi des appels à bénévoles décrit la remise en attente. Le mode d'emploi de l'API décrit le statut vu sur les acceptations.
- Le glossaire n'a pas de terme nouveau : « en attente » et « liste d'attente » existent déjà.

## Revue de sécurité

Les tests de la mise en œuvre prouvent chaque contrôle par le refus :

- une acceptation avec `statutAttendu` sur un choix refusé entre-temps répond `CONFLIT_VERSION`, n'écrit rien et ne met aucun mail en file ;
- deux acceptations simultanées avec le même `statutAttendu` ne créent qu'une place, rendent toutes les deux la candidature acceptée et ne mettent qu'un mail en file ;
- une acceptation avec `statutAttendu` sur un choix déjà accepté rend la candidature sans erreur et n'écrit rien ;
- `placerBenevole` avec `statutAttendu` sur une séquence sans choix répond `CONFLIT_VERSION` ;
- une personne qui n'écrit pas la séquence ne remet pas un choix en attente ;
- un jeton d'accès ou d'application en lecture ne remet pas un choix en attente ;
- une personne d'une autre activité ou d'une autre organisation ne remet pas un choix en attente ;
- un choix d'une candidature retirée ne revient pas en attente ;
- une remise en attente ne met aucun mail en file ;
- une remise en attente simultanée d'une acceptation du même choix ne laisse jamais un choix en attente à côté d'une place acceptée ;
- une remise en attente simultanée d'une acceptation sur la même séquence calcule le statut avec les renforts de cette acceptation ;
- une ligne importée avec un identifiant externe revient en attente avec une adresse en attente nulle, même quand un autre billet de la même adresse attend sur l'appel ;
- une remise en attente qui créerait une seconde candidature en attente pour la même adresse sur le même appel répond une erreur de saisie.

## Plan de mise en œuvre

1. Serveur : argument `statutAttendu` sur les deux acceptations, mutation `remettreChoixEnAttente`, tests (cette ADR, une fois acceptée).
2. Espace organisateur : envoi du statut affiché, proposition de recharger après un conflit, bouton « Remettre en attente ».
3. Modes d'emploi, et passage de l'ADR à « acceptée ».
