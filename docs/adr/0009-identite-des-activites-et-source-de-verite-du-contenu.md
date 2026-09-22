# ADR 0009 — Identité des activités et source de vérité du contenu

- **Statut** : acceptée
- **Date** : 2026-09-22
- Complète les ADR 0006 et 0008. Remplace le point de l'ADR 0003 qui fait du dépôt Git la source des modèles.

## Contexte

L'ADR 0008 a donné plusieurs activités à une organisation. Quatre besoins restent ouverts :

- Une activité a souvent sa propre identité : un logo, des couleurs, un contact de recrutement, une page d'équipe. Seule l'organisation porte aujourd'hui ces valeurs.
- Le logo est une simple adresse. Relaytour ne stocke aucune image, et les mails n'affichent aucun logo.
- Les admins d'une organisation ne peuvent modifier ni son identité ni son thème. Ces valeurs ne changent que par l'import de `organisation.yaml`.
- L'export ne réécrit que les fiches modifiées dans l'application. Il ignore l'organisation, les activités et les périmètres créés dans l'application. Un import suivant peut écraser ce que les admins ont saisi.

Un point touche aussi la protection des données. `domainesCourrielAutorises` désigne les adresses de rôle de l'organisation. Une adresse de ces domaines passe pour institutionnelle : les fiches et l'export l'acceptent sans la signaler. Rien n'empêchait d'y placer un domaine de messagerie grand public. Ce réglage aurait alors désactivé la détection des adresses personnelles.

## Décision

### L'application est la source de vérité

- L'application porte le contenu d'une organisation. Le dossier de contenu devient une archive, un moyen de transfert et un point de départ. Une organisation sans compétence Git n'en a pas besoin.
- L'export écrit tout le contenu : `organisation.yaml`, `activite.yaml` de chaque activité, périmètres, fiches, tâches types et images. Il suit la disposition du dossier cible, plate ou `activites/`.
- L'export est iso. Importer un export ne change rien, et exporter un import redonne le même contenu. Un test d'aller-retour sur `content/exemple` le prouve.
- L'export ne réécrit un fichier que si son sens change. Un fichier écrit à la main garde ses commentaires et sa mise en forme. Une image garde son chemin quand son empreinte ne change pas.
- La base garde les tâches types d'un périmètre (`Perimetre.tachesTypes`) et son effectif par défaut (`Perimetre.effectifParDefaut`). L'export les réécrit sans les reconstituer depuis les tâches d'une période.
- `Organisation.contenuModifieLe` date chaque modification du contenu faite dans l'application : identité, activités, périmètres. `Organisation.contenuSynchroniseLe` date le dernier import ou export. Un import refuse d'écraser une modification plus récente que la dernière synchronisation. L'option `--forcer` l'y autorise.
- Les fiches gardent leur protection propre : l'import signale un conflit sur une fiche modifiée dans l'application et ne la remplace pas.
- Les admins téléchargent le contenu en archive zip depuis l'espace organisateur. L'archive ne contient aucune personne, aucune affectation, aucun souhait ni aucune tâche datée. Elle reste distincte de l'export de l'installation (ADR 0008), qui sert à la portabilité des données.
- Un import en disposition `activites/` retire l'activité vide créée avec l'organisation, comme l'activité d'amorçage `defaut`. Elle deviendrait sinon l'activité affichée par défaut.

### Une identité commune à l'organisation et à l'activité

- L'organisation porte son identité dans sa déclaration : nom, sigle, contact de recrutement, page d'équipe, logo, favicon et thème.
- Une activité porte une identité propre (`Activite.identite`) : contact de recrutement, page d'équipe, logo, couleurs et fond. Chaque champ absent reprend la valeur de l'organisation, puis celle de Relaytour.
- Le thème d'une activité ne surcharge que les couleurs et le fond. Les polices et la typographie restent celles de l'organisation, pour une identité cohérente entre ses activités. Le contrôle de contraste porte sur le thème fusionné.
- Le contact d'une activité reste une adresse de rôle de l'organisation.
- L'écran de connexion, le choix d'organisation et le favicon gardent l'identité de l'organisation. Les écrans d'une activité prennent son thème et son logo.
- Un mail qui concerne une seule activité, comme la modification d'une tâche, prend son identité. Le résumé et les rappels, qui couvrent plusieurs activités, gardent celle de l'organisation. L'appel aux référentes et référents cite les contacts de l'activité.

### Des images stockées par Relaytour

- Une table `Media` garde les images en base, avec les sauvegardes et l'export de l'installation. Une image se désigne par son empreinte SHA-256.
- Le logo PNG est obligatoire, car Gmail et Outlook n'affichent pas le SVG. Un logo SVG facultatif le remplace à l'écran. Le favicon est un PNG.
- Un PNG pèse 512 Ko au plus, un SVG 128 Ko au plus. Le serveur déduit le format du contenu, jamais du nom de fichier. Il refuse un SVG qui porte un script, un gestionnaire d'événement, un contenu HTML, une entité XML ou une ressource externe.
- La route `/medias/<empreinte>.<png|svg>` sert les images sans session, comme le nom et le thème de l'écran de connexion. Elle ajoute une politique de sécurité qui bloque tout script, et un cache d'un an : le contenu d'une adresse ne change jamais.
- Une image entre par le dossier de contenu, où `organisation.yaml` et `activite.yaml` la nomment par un chemin relatif. Elle entre aussi par téléversement dans l'espace organisateur, réservé aux admins. L'export la réécrit dans le dossier.
- L'en-tête d'un mail affiche le logo PNG, sinon le nom de l'organisation. `rendre()` compose cette balise ; aucune valeur saisie ne l'écrit.

### Relaytour reste en signature

- L'en-tête affiche le logo de l'activité, sinon celui de l'organisation, sinon le pictogramme de Relaytour.
- Le pied de la barre latérale et de l'écran de connexion garde la signature « Propulsé par Relaytour ». Le mot « Relaytour » porte le lien vers le code source, ce qui tient la ligne en trois mots. L'article 13 de l'AGPL impose d'offrir le code source aux personnes qui utilisent le logiciel par le réseau.
- `CODE_SOURCE_URL` fixe ce lien. Par défaut, il mène au dépôt public. Un hébergeur qui modifie le logiciel y indique son propre dépôt.

### L'autonomie des organisations et la place de l'hébergeur

- Les admins d'une organisation modifient son identité, son thème, ses adresses de rôle et ses images depuis la page « Organisation ». Ils modifient l'identité d'une activité depuis la page « Activités ».
- Le slug, le fuseau horaire, le statut et les limites restent à l'administration de l'installation (ADR 0008). Une organisation en lecture seule garde l'export de son contenu.
- Le portail d'un hébergeur et Relaytour gèrent des données distinctes. Le portail porte l'identité de facturation : raison sociale, adresse, contact de paiement, palier. Relaytour porte le profil affiché aux membres. Le portail lie son client à une organisation par son slug, fixe le statut et les limites, et lit le nom affiché par la liste des organisations. Un écart entre le nom facturé et le nom affiché est normal.
- Relaytour n'appelle pas le portail à chaque modification. Le portail lit les organisations à la demande.
- Les limites restent des quotas. Aucun interrupteur de fonction n'entre dans les limites tant qu'aucun hébergeur n'en a besoin.

### Les adresses de rôle

- `domainesCourrielAutorises` s'affiche « Domaines des adresses de rôle ». Il ne limite pas les invitations.
- Relaytour refuse un domaine de messagerie grand public dans cette liste, sous-domaines compris (`MESSAGERIES_GRAND_PUBLIC`, `lib/contenu.ts`). L'amorçage par `DOMAINES_COURRIEL_AUTORISES` les ignore.
- `adressesRoleAutorisees` accepte des adresses complètes, une par une. Une association dont la seule boîte partagée est hébergée chez une messagerie grand public l'y déclare.
- L'espace organisateur avertit l'admin : une adresse de rôle passe pour institutionnelle, et Relaytour la publie sans avertissement. Une adresse nominative reste une donnée personnelle au sens du RGPD, même chez une messagerie grand public.

## Conséquences

- Une migration additive ajoute la table `Media`, `Activite.identite`, `Perimetre.effectifParDefaut`, `Perimetre.tachesTypes`, `Organisation.contenuModifieLe` et `Organisation.contenuSynchroniseLe`. Les colonnes nouvelles restent vides jusqu'au prochain import.
- `orga:exporter` écrit désormais tout le contenu. Un dépôt d'organisation reçoit au premier export les fichiers que la base décrit et que le dépôt ne décrivait pas.
- Un proxy devant l'espace organisateur relaie `/medias/*` vers l'API, comme `/graphql`. Le Caddyfile d'exemple et le proxy de Vite le font.
- La page « Organisation » et la page « Activités » ajoutent un éditeur d'identité. L'éditeur de tâches types viendra plus tard ; les tâches types ne changent aujourd'hui que dans le dossier de contenu.
- Le dossier `modeles/` d'un dépôt d'organisation reste une aide à la rédaction. L'export ne l'écrit pas.

## Revue de sécurité

- Les mutations `modifierIdentiteOrganisation`, `modifierIdentiteActivite` et `televerserMedia`, et la requête `exportContenu`, exigent le rôle ADMIN dans l'organisation active. Un membre reçoit un refus. `modifierIdentiteActivite` entre dans la table des refus croisés.
- Une organisation ne désigne que ses propres images. L'empreinte d'une image d'une autre organisation est refusée.
- Une image est publique par son adresse, comme toute image d'identité. L'empreinte ne se devine pas.
- Le corps d'une requête GraphQL reste limité à 1 Mo, ce qui borne un téléversement.
