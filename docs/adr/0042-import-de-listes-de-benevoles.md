# ADR 0042 — Import de listes de bénévoles, doublons et fusion des fiches

- **Statut** : proposée
- **Date** : 2026-10-22
- Complète l'ADR 0041 (appels à bénévoles, candidatures et répartition) et l'ADR 0040 (fiches bénévoles).

## Contexte

Une organisation recrute souvent ses bénévoles hors de Relaytour : une billetterie gratuite, un formulaire en ligne, un tableur partagé. L'équipe ressaisit ensuite chaque personne dans l'écran « Bénévoles ». Une même personne finit parfois avec deux fiches.

Un export de billetterie réel a servi d'exemple. Seule sa forme est décrite ici, et aucune de ses valeurs :

- une feuille, une quarantaine de colonnes, une ligne par billet ;
- une majorité de lignes sans personne : un lot de billets nommés « #12345 », sans adresse ni téléphone ;
- le prénom et le nom en double (« participant » et « acheteur »), une adresse, un téléphone au format international ;
- une colonne par poste et par créneau (« Service au bar - 18h - 19h »), remplie quand le créneau est choisi ;
- une colonne « Prestations » qui répète le poste et ses horaires sur plusieurs lignes d'une même cellule ;
- un texte libre de disponibilité (« à partir de 18 h, tout poste sauf photo ») ;
- des horaires sans jour : le jour n'apparaît que dans le nom du fichier ;
- des colonnes sans rapport avec Relaytour : paiement, montant, genre, pronom, billet scanné.

Le besoin porte sur quatre points :

- lire un fichier CSV ou Excel et associer ses colonnes aux champs de Relaytour, avec une détection corrigeable ;
- accepter les formes de fichiers les plus courantes, sans viser tous les cas ;
- associer les choix aux séquences du programme, ou à défaut ranger les personnes par leurs disponibilités ;
- repérer les doublons, dans le fichier et avec les fiches existantes, et fusionner deux fiches.

## Décision

### Les notions

- Un **import de bénévoles** fait entrer les personnes d'un fichier dans une période d'une activité.
- La **portée** d'un import est le programme entier ou un périmètre, comme la portée d'un appel (ADR 0041).
- Une **correspondance d'import** enregistre l'association des colonnes d'un fichier aux champs de Relaytour, pour la réutiliser. Le mot « modèle » désigne déjà le texte de départ d'un message (ADR 0020).
- La **source** d'un import est le libellé que la personne qui importe lui donne : « billetterie du 7 août ».
- L'**identifiant externe** d'une ligne est la valeur d'une colonne qui la désigne dans l'outil d'origine, comme un numéro de billet.
- Un **rapprochement** est un lien proposé entre une personne du fichier et une fiche existante, ou entre deux fiches.
- **Fusionner** deux fiches réunit leurs places, leurs plages et leurs candidatures dans une seule fiche, et supprime l'autre.

### Qui importe

- Un admin de l'activité importe pour le programme entier.
- Une personne qui écrit dans un périmètre importe pour ce périmètre. Une valeur associée à une séquence d'un autre périmètre est refusée dans l'aperçu.
- Une fiche créée par un import suit les règles de l'ADR 0040 : la personne qui importe en lit les coordonnées comme leur créatrice.

### Lecture du fichier

- Le navigateur lit le fichier. Seules les colonnes associées partent vers le serveur.
- Une colonne ignorée ne quitte jamais le poste : le genre, le paiement ou la santé ne sont jamais transmis. Le fichier ne se garde nulle part (invariants 2 et 16).
- Les formats acceptés sont le CSV et le XLSX. Le séparateur du CSV (point-virgule, virgule ou tabulation) et son encodage (UTF-8 avec ou sans BOM, Windows-1252) sont détectés. Un fichier XLSX à plusieurs feuilles demande le choix de la feuille.
- ODS et Google Sheets restent hors du périmètre : un export CSV les couvre.
- Les bibliothèques sont `papaparse` pour le CSV et `read-excel-file` pour le XLSX. Elles sont sous licence MIT, comme leurs dépendances. Elles se chargent à la demande, sur l'écran d'import seulement.
- Un fichier compte 2 Mo, 5 000 lignes et 200 colonnes au plus.

### Détection et association des colonnes

- Chaque champ de Relaytour a une liste de synonymes, comparés sans accent ni casse : prénom, nom, nom complet, adresse, téléphone, précisions de disponibilité, choix, identifiant externe, regroupement.
- Le contenu confirme la détection : une adresse contient « @ », un téléphone compte au moins six chiffres, un horaire suit la forme « 17h - 18h » ou « 17:00-18:00 ».
- À détection égale, une colonne remplie l'emporte sur une colonne presque vide.
- L'écran montre une ligne par colonne du fichier : son en-tête, trois exemples, le champ proposé et le niveau de confiance. La personne corrige par une liste. Une colonne inconnue est ignorée par défaut.
- Aucun champ de Relaytour ne reçoit le genre, la santé ou un paiement. Ces colonnes ne peuvent qu'être ignorées.

### Formes de fichiers

L'import accepte quatre formes, combinables dans un même fichier :

1. **Une ligne par personne**, avec des colonnes simples.
2. **Une colonne par poste ou par créneau.** Une cellule non vide signifie « choisi ». La personne déclare les valeurs qui signifient « non » (« non », « false », « 0 »). L'aperçu montre l'effet de ce réglage.
3. **Plusieurs lignes par personne.** Une colonne de regroupement (adresse, numéro de commande) réunit les lignes. Un champ rempli sur une seule ligne du groupe vaut pour tout le groupe.
4. **Une cellule à plusieurs valeurs** : un poste puis des horaires, séparés par des retours à la ligne, des virgules ou des points-virgules.

Plusieurs feuilles à combiner, des cellules fusionnées, des tableaux croisés et des formules à recalculer restent hors du périmètre.

### Association aux séquences

- Une colonne de la forme 2 s'associe en entier à une séquence, ou à un créneau seulement. L'horaire se lit dans l'en-tête : « Service au bar - 18h - 19h » donne le créneau de 18 h à 19 h.
- Pour les formes 3 et 4, l'écran liste les valeurs distinctes. Pour chacune, il propose une séquence par proximité du titre et recouvrement de l'horaire.
- Un horaire sans jour reçoit le jour choisi à l'import.
- Une colonne ou une valeur peut aussi devenir une plage de disponibilité seulement, ou être ignorée.
- Sans aucune association à une séquence, l'import range quand même chaque personne par ses plages. Elle rejoint les bénévoles à répartir, et l'équipe la place plus tard dans la vue « Répartition » (ADR 0041).
- Un texte libre devient les précisions de disponibilité. Aucune analyse automatique de ce texte n'est prévue.

### Lignes écartées

- Une ligne sans nom, sans adresse et sans téléphone est écartée. Un nom de la forme « #12345 », ou fait de chiffres seulement, compte comme vide.
- L'aperçu annonce le compte (« 18 personnes, 100 lignes écartées ») et liste les motifs.
- La personne peut télécharger les lignes écartées en CSV. Le navigateur produit ce fichier, sans passer par le serveur.

### Doublons

- **Dans le fichier**, deux lignes désignent la même personne quand elles ont la même adresse sans casse, le même téléphone ramené au format international, ou le même nom. Le nom se compare sans accent ni casse, prénom et nom dans les deux ordres. Les lignes se réunissent et leurs choix s'additionnent.
- **Avec les fiches de l'activité**, un rapprochement a trois niveaux :
  - fort : la même adresse, rattachement proposé d'office ;
  - moyen : le même téléphone ;
  - faible : le même nom, ou un nom très proche (deux lettres d'écart au plus, même initiale).
- Pour un niveau moyen ou faible, l'aperçu demande « Rattacher à la fiche existante » ou « Créer une fiche ».
- **Avec les membres** : une personne du fichier qui a un compte n'est signalée qu'aux admins de l'activité. Une personne qui écrit dans un périmètre n'apprend rien de l'annuaire (ADR 0015).
- Les règles de rapprochement vivent dans un module pur, partagé par le serveur et l'écran.

### Écriture

La personne choisit le mode à chaque import :

- **À répartir.** Chaque personne devient une candidature dans un appel d'import. Ses choix associés passent par la file des candidatures, la jauge et la liste d'attente (ADR 0041). Une option « Accepter tout » traite ces choix d'un geste. Sans choix associé, la personne n'a que ses plages et ses précisions, et elle attend dans les bénévoles à répartir.
- **Places directes.** Chaque personne reçoit une fiche et une place dans les séquences associées. Ce mode exige au moins une association à une séquence. Un dépassement du besoin avertit sans bloquer.

Dans les deux modes :

- L'appel d'import est un appel sans adresse publique, fermé, créé pour l'occasion ou choisi parmi les appels d'import de la période. Il garde la portée de l'import. Les bénévoles à répartir de cet appel se lisent donc selon les règles de l'ADR 0041.
- La personne qui importe déclare que les personnes du fichier ont donné leur accord. Elle nomme la source. La date et la source se gardent sur chaque candidature et sur chaque fiche créée.
- Une fiche créée par un import a l'origine `IMPORT`. Elle garde le périmètre de l'import, qui borne la lecture de ses plages dans la vue « Répartition ».
- Les mails suivent l'ADR 0041. L'import n'envoie rien. La première place d'une fiche joignable envoie le lien personnel. L'option « Prévenir par mail » de l'import, cochée par défaut, se reporte sur chaque fiche créée.
- Une colonne d'identifiant externe rend l'import rejouable. Une ligne déjà importée dans le même appel d'import est ignorée : un fichier mis à jour n'ajoute que les nouvelles personnes.
- Le serveur revalide tout. Une simulation rend le rapport sans rien écrire, comme `orga:importer --simulation`. L'écriture se fait ensuite par lots de 500 personnes, chacun dans une transaction.
- Un import ne dépasse pas le plafond de 2 000 fiches par activité (ADR 0040). La simulation l'annonce.

### Correspondances d'import

- Une correspondance porte un nom, les en-têtes attendus, les associations et les réglages : valeurs « non », jour par défaut, mode. Elle ne contient aucune donnée personnelle ni aucune séquence.
- Elle appartient à l'activité. Toute personne qui peut importer dans l'activité la lit et l'utilise.
- L'import d'un fichier aux mêmes en-têtes propose d'office la correspondance enregistrée.

### Fusion des fiches

- L'écran « Bénévoles » reçoit un panneau « Doublons possibles », calculé par les règles de rapprochement.
- « Fusionner » ouvre une comparaison champ par champ. La personne choisit le nom, l'adresse et le téléphone gardés. Les notes se mettent bout à bout.
- La fusion réunit les places, avec une seule place par séquence : « responsable » l'emporte sur « renfort », et une place confirmée sur une place à confirmer.
- Elle réunit aussi les plages, sans doublon, et rattache les candidatures à la fiche gardée.
- Elle garde l'accord le plus ancien et la confirmation d'adresse la plus récente. Le lien personnel de la fiche gardée reste valable, et celui de l'autre fiche cesse de répondre.
- Tout s'écrit dans une transaction, sous le verrou de l'organisation, avec une ligne au journal.
- « Ce ne sont pas des doublons » écarte une paire, qui ne revient plus.
- Seuls les admins de l'activité fusionnent : la fusion touche des fiches créées par d'autres personnes.

## Conséquences

- Une migration additive ajoute :
  - `IMPORT` à l'origine d'une fiche, et à `Benevole` le périmètre de son import, sa source et ses précisions de disponibilité ;
  - à `Candidature` son origine (`PUBLIC` ou `IMPORT`), sa source et son identifiant externe, unique par appel ;
  - à `AppelBenevoles` l'indicateur « sans adresse » ;
  - les tables `CorrespondanceImport` et `PaireDistincte`.
- Chaque unicité est bornée par un parent (invariant 18). Chaque table porte `organisationId` ou s'y rattache par son parent.
- La table des refus croisés couvre chaque nouvelle requête et chaque nouvelle mutation.
- Des tests prouvent qu'une personne qui écrit dans un périmètre n'importe rien dans un autre, et qu'elle ne lit aucun rapprochement avec l'annuaire (invariant 11).
- `packages/orga` reçoit deux dépendances MIT, chargées à la demande. `outils/verifier-licences.mjs` les vérifie.
- Les fichiers d'essai sont fictifs. Ils reprennent les quatre formes de fichiers, dont une imitation d'export de billetterie. Aucun fichier réel n'entre dans le dépôt (invariant 2).
- L'export complet de l'organisation reprend les correspondances d'import et les nouvelles colonnes.
- Le glossaire reçoit : import de bénévoles, correspondance d'import, source d'import, identifiant externe, rapprochement, fusion de fiches.

## Revue de sécurité

- Le fichier ne quitte pas le navigateur. Seules les colonnes associées partent vers le serveur, et le serveur ne garde pas le fichier.
- Une colonne sensible (genre, santé, paiement) ne peut être associée à aucun champ.
- La personne qui importe déclare l'accord des personnes du fichier et nomme la source. Cette trace reste sur chaque fiche et chaque candidature.
- Une personne qui écrit dans un périmètre n'importe que pour ses séquences. Elle n'apprend rien des comptes de l'organisation.
- L'import n'envoie aucun mail. Un fichier qui contient des adresses erronées ne déclenche d'envoi qu'à la première place d'une fiche, après une décision de l'équipe.
- La fusion est réservée aux admins de l'activité et laisse une trace au journal.

## Questions ouvertes

1. **Nom de la notion.** « Correspondance d'import » remplace « modèle d'import », car « modèle » désigne le texte de départ d'un message. Ce nom convient-il ?
2. **Précisions sur la fiche.** En mode « places directes », les précisions de disponibilité n'ont pas de place sur la fiche aujourd'hui. Proposé : un champ « précisions de disponibilité » sur la fiche, distinct de sa note, lu comme ses plages.
3. **Date de l'accord.** Proposé : la date de l'import, avec la source. Une colonne « date de commande » pourrait la remplacer quand le fichier en porte une.
4. **Appel d'import.** Proposé : un appel d'import par source, réutilisable pour un fichier mis à jour. Il apparaît dans l'onglet « Appels », sans bouton d'adresse.
