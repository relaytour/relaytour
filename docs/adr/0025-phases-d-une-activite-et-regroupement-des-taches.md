# ADR 0025 — Phases d'une activité et regroupement des tâches

- **Statut** : acceptée
- **Date** : 2026-10-08
- Complète l'ADR 0008 (groupes de périmètres) et l'ADR 0009 (source de vérité du contenu).

## Contexte

La page d'un périmètre et le rétroplanning classent les tâches par échéance. Le rétroplanning les regroupe par mois. Aucune autre lecture n'existe.

Cette lecture suffit tant qu'un périmètre enchaîne ses tâches dans le temps. Elle montre ses limites dans trois cas, relevés sur une activité d'une vingtaine de périmètres et de trois cents tâches :

- Un pôle transverse mène plusieurs sujets en parallèle. Les tâches d'un même sujet se retrouvent dispersées dans la liste, à plusieurs mois d'écart.
- Les échéances se concentrent sur quelques dates. Le rétroplanning affiche alors plusieurs dizaines de tâches sous le même jour, sans ordre entre elles.
- Les équipes ne pensent pas en mois. Leurs fiches méthode décrivent des étapes nommées et bornées en jours avant l'événement.

Trois options étaient possibles :

- une étiquette libre sur chaque tâche ;
- un champ de priorité sur chaque tâche ;
- des phases déclarées par l'activité, où une tâche se range par son échéance.

Une étiquette libre n'a pas de propriétaire. Chaque périmètre créerait son vocabulaire, et les équipes changent d'une période à l'autre. Un champ de priorité double l'échéance : une tâche proche ou en retard est déjà signalée.

Les phases suivent le modèle des groupes de périmètres (ADR 0008) : un vocabulaire court, déclaré par l'activité dans son contenu. La fiche liée à une tâche offre par ailleurs un regroupement par sujet, sans aucun champ nouveau.

## Décision

### Phases

- Une activité déclare ses **phases**, dans l'ordre. Une phase porte une clé, un libellé et une borne.
- La borne `jusquA` désigne le dernier jour de la phase. Elle compte les jours depuis le premier jour de la période, dans la notation des tâches types : `J-120`, `J+30`.
- Les bornes se suivent dans l'ordre croissant. La dernière phase ne porte pas de borne : elle reçoit toutes les tâches qui suivent. Les phases couvrent ainsi toute la période, sans trou ni chevauchement.
- Une activité déclare entre 1 et 12 phases.
- Une activité qui ne déclare rien garde quatre phases par défaut : Lancement (jusqu'à J-120), Préparation (jusqu'à J-30), Derniers réglages (jusqu'à J-1), Déroulement et bilan.

### Rangement d'une tâche

- Une tâche ne porte aucune phase. Elle se range par son échéance, dans la première phase dont la borne n'est pas dépassée.
- Une tâche sans échéance n'appartient à aucune phase.
- Le rangement se calcule dans l'espace organisateur, à partir des phases de l'activité et du premier jour de la période. Les deux dates sont des jours calendaires : aucun fuseau horaire n'intervient.
- Modifier les phases change le rangement de toutes les tâches, sans aucune écriture sur les tâches.

### Contenu et application

- Les phases sont du contenu (ADR 0009). `activite.yaml` les déclare sous la clé `phases`, l'import les écrit en base et l'export les réécrit.
- La colonne `Activite.phases` est nulle tant que l'activité ne déclare rien. L'export n'écrit alors aucune clé `phases`.
- La disposition plate du contenu ne décrit pas de phases. Une organisation qui en déclare exporte son contenu en disposition `activites/`.
- Les admins de l'activité modifient les phases dans l'espace organisateur, par la mutation `modifierActivite`. L'argument `phases` est facultatif : absent, les phases ne changent pas.
- Le contenu et la mutation appliquent le même schéma de validation (`packages/server/src/lib/phases.ts`).

### Regroupements

- La page d'un périmètre regroupe ses tâches par échéance, par phase ou par fiche.
- Le rétroplanning regroupe les tâches par mois ou par phase. Dans une phase, les tâches se rangent par périmètre.
- Le navigateur garde le regroupement choisi. Ce choix ne s'enregistre pas sur le serveur.

### Ce qui n'entre pas

- Aucune étiquette libre et aucun champ de priorité ne s'ajoutent à la tâche.
- Un thème déclaré par l'activité et porté par la tâche reste possible. Il demanderait une nouvelle ADR, après l'usage des phases et du regroupement par fiche.

## Conséquences

- Une migration additive ajoute la colonne `Activite.phases`, nulle par défaut.
- Le contrat GraphQL gagne le type `Phase`, l'entrée `PhaseInput`, le champ `Activite.phases` et l'argument `phases` de `creerActivite` et de `modifierActivite`.
- La table des refus croisés couvre l'argument nouveau. Un test prouve le refus d'une référente et d'une requête sans session.
- Un changement de phases par un admin atteint les autres navigateurs à leur prochain chargement, comme un changement de groupes aujourd'hui.
- Le glossaire gagne « phase ».
