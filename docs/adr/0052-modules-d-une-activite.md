# ADR 0052 — Modules d'une activité

- **Statut** : acceptée
- **Date** : 2026-10-28
- Complète l'ADR 0008 (activités et administration de l'installation). Ne change pas sa section « Frontière des extensions ».

## Contexte

L'espace organisateur montre les mêmes écrans à toutes les activités. Une association qui découvre Relaytour voit l'agenda, les bénévoles et les documents du fournisseur cloud avant d'en avoir besoin. Ces écrans allongent le menu et la prise en main.

Ces écrans sont indépendants du cœur de l'application : périmètres, tâches, fiches, équipe et périodes. Une activité peut s'en passer sans perdre son suivi.

Un hébergeur peut aussi vouloir proposer une offre sans certains écrans, par exemple sans fournisseur cloud.

## Décision

### Les modules

- Un module est un écran facultatif d'une activité, avec ses données et ses envois. La liste des modules est fixée dans le code (`packages/server/src/lib/modules.ts`).
- Trois modules existent :
  - `AGENDA` : l'écran « Agenda », ses réunions, ses sondages, ses dates clés et ses abonnements iCalendar (ADR 0037) ;
  - `BENEVOLES` : l'écran « Bénévoles », les appels à bénévoles, les candidatures, l'espace bénévole et l'import de bénévoles (ADR 0040, 0041, 0042) ;
  - `DOCUMENTS` : l'onglet « Documents » de l'écran « Ressources » et les documents liés d'une fiche (ADR 0043).
- Le programme reste toujours actif : les appels à bénévoles portent sur ses séquences.
- Le réglage du fournisseur cloud reste au niveau de l'organisation. L'export des fiches vers le fournisseur continue sans le module `DOCUMENTS`.

### Activation par l'activité

- `Activite.modules` (Json, en base seulement) porte la liste des modules actifs. Un import ou un export du contenu n'y touche jamais.
- Une valeur nulle active tous les modules. Les activités créées avant cette décision gardent ainsi tous leurs écrans. L'activité `defaut`, que les migrations créent dans une installation neuve, les garde aussi.
- Une activité créée ensuite, dans l'espace organisateur ou par `orga:importer`, démarre sans module.
- Les admins de l'activité activent et désactivent ses modules dans l'écran « Activités ».

### Restriction par l'hébergeur

- `Organisation.modulesAutorises` (Json) porte la liste des modules que l'administration de l'installation autorise. Une valeur nulle les autorise tous.
- Le champ est distinct de `Organisation.limites` : le schéma des limites refuse tout champ inconnu, et une version antérieure perdrait toutes ses limites après un retour arrière.
- L'API d'administration de l'installation règle la liste (`modifierOrganisationInstallation`) et la lit.
- Un module actif dans une activité mais non autorisé reste inactif. Le choix de l'activité est gardé : le module revient si l'hébergeur l'autorise de nouveau.
- Une organisation auto-hébergée garde tous les modules autorisés. Aucun module n'est réservé à une offre dans le code (ADR 0005).

### Effet d'un module inactif

- Le menu n'affiche pas son écran. Une adresse directe redirige vers « Mon espace » avec un message.
- Le serveur refuse ses requêtes et ses mutations avec le code `MODULE_INACTIF`.
- L'adresse publique d'un appel à bénévoles répond comme un lien inconnu, et le formulaire public n'indique plus d'appel. Un abonnement iCalendar de l'activité répond 404, et un abonnement personnel omet l'activité.
- L'espace bénévole reste ouvert par son lien personnel : chaque personne y garde l'accès à ses données et peut les supprimer. L'équipe ne crée ni ne renvoie plus de lien.
- Un admin de l'organisation lit encore les dossiers liés de l'activité dans l'écran du fournisseur cloud, pour les régler.
- Le worker n'envoie pas un mail en attente qui concerne une réunion ou une fiche bénévole de ce module.
- Les données restent en base et réapparaissent à la réactivation. L'export complet de l'organisation les contient. Les purges planifiées continuent.

### Extensions

- Un module n'est pas une extension. Son code fait partie du logiciel publié, et le serveur ne charge aucun module tiers (ADR 0008).
- Des extensions écrites par la communauté demanderaient une nouvelle ADR qui remplace la section « Frontière des extensions » de l'ADR 0008. Elle devrait traiter la licence d'une œuvre combinée, le contrôle d'accès et les migrations.

## Conséquences

- Une nouvelle activité affiche un menu court. Ses admins activent les modules dont ils ont besoin.
- Chaque résolveur d'un module appelle `exigerModule`. Un module nouveau ajoute sa valeur à la liste et ses gardes, côté serveur comme côté client.
- Les notifications déjà créées pour un module inactif restent dans la cloche. Leur lien mène à la redirection vers « Mon espace ».
- Deux migrations additives : `Activite.modules` et `Organisation.modulesAutorises`, nullables.
