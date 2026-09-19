# ADR 0002 — Connexion par code mail avec Better Auth

- **Statut** : acceptée (mise en œuvre en phase 1)
- **Date** : 2026-09-15

## Contexte

Les référentes et référents changent à chaque édition et se connectent rarement. Un mot de passe serait oublié d'une édition à l'autre. Les annuaires des associations (suite bureautique, outil de gestion) ne couvrent pas toutes les personnes concernées et n'offrent pas toujours d'API.

Better Auth fournit la connexion par code, par lien et, plus tard, par un fournisseur d'identité externe, sans code d'authentification maison à maintenir.

## Décision

- Better Auth avec l'adaptateur Prisma (fournisseur `mysql`) et les plugins `emailOTP` (`storeOTP: "hashed"`, remplacé par `"encrypted"` le 19 septembre 2026, voir plus bas) et `magicLink`. Le handler est monté sur `/api/auth/*`.
- **Inscription fermée** : seul un admin crée un compte. Une adresse inconnue reçoit la même réponse qu'une adresse connue, et aucun mail.
- Code à 6 chiffres valable 10 minutes, 5 essais au plus. Limitation de débit stockée dans Redis.
- Sessions en base, cookie `httpOnly`, `Secure`, `SameSite=Lax`, limité à l'hôte de l'API. Durée 30 jours glissants, révocables par un admin.
- L'identité repose sur l'identifiant utilisateur, jamais sur l'adresse. Chaque lien signé porte un `purpose` obligatoire.
- Les droits se vérifient dans le schéma par Pothos `scope-auth`.

### Exception à la règle des mails

La charge utile d'un job de mail ne contient normalement aucun jeton. Le worker ne lit pas la table `Verification` et ne peut pas reconstituer le code. Le job du code de connexion porte donc le code en clair, avec trois protections :

- il expire après 10 minutes, comme le code ;
- il est supprimé dès son traitement, réussi ou non (`removeOnComplete`, `removeOnFail`) ;
- il n'est jamais journalisé (champ `code` caviardé par le journal).

## Conséquences

- Better Auth ajoute ses tables (`User`, `Session`, `Account`, `Verification`). Leurs noms suivent ses conventions, différentes de celles des autres projets.
- La délivrabilité des mails devient critique : SPF, DKIM et DMARC doivent être en place avant l'ouverture.
- Le même système servira plus tard aux bénévoles et aux sportives et sportifs.

## Mise en œuvre (phase 1, 16 septembre 2026)

Trois points diffèrent de la décision initiale. Ils ont été tranchés pendant la mise en œuvre.

1. **Pas de plugin `magicLink`.** Un seul mail contient le code et un lien `https://orga…/connexion#code=123456&adresse=…`. Le code et l'adresse sont placés après `#` : le navigateur ne les envoie jamais au serveur et ils n'entrent dans aucun journal. L'écran de connexion remplit les deux champs. La connexion part sans clic seulement si l'adresse du lien est celle saisie dans le même onglet pour demander le code ; dans un autre onglet ou un autre navigateur, la personne valide elle-même (mise à jour du 19 septembre 2026, voir « Liens forgés »). Deux plugins auraient produit deux mails et deux jetons pour une même demande.
2. **Une seule origine pour le navigateur.** L'espace organisateur relaie `/api/auth/*` et `/graphql` vers l'API (Caddy en production, Vite en local). Le cookie `relaytour.session_token` est donc un cookie de première partie, sans CORS ni domaine partagé.
3. **Limitation de débit en base, plus une limite par adresse dans Redis.** Better Auth stocke ses compteurs par IP dans la table `RateLimit`. Un hook ajoute une limite de 5 codes par adresse sur 15 minutes, dans Redis.

S'y ajoutent deux garde-fous :

- seules quatre routes de Better Auth sont ouvertes (`send-verification-otp`, `sign-in/email-otp`, `get-session`, `sign-out`), toutes les autres répondent 404 ;
- un compte archivé ne peut plus ouvrir de session, et son archivage supprime ses sessions en cours.

## Mise à jour du 19 septembre 2026 : deux corrections de sécurité

### Liens forgés

Un lien de connexion connectait la personne dès l'ouverture de la page, quelle que soit l'adresse qu'il portait. Une personne qui demande un code sur son propre compte pouvait forger un lien avec ce code et son adresse, l'envoyer à une autre et la faire travailler dans ce compte à son insu. La connexion automatique n'a lieu désormais que si l'adresse du lien est identique, sans tenir compte de la casse, à l'adresse mémorisée dans l'onglet au moment de la demande de code. Sans adresse dans le lien, l'adresse mémorisée sert. Dans tous les autres cas, l'écran prérempli attend un clic (`packages/orga/src/lib/connexion.ts`, `adresseConnexionAutomatique`).

### Verrouillage ciblé

Avec `storeOTP: "hashed"`, chaque demande de code remplaçait le code précédent (`resendStrategy: "rotate"`, et la réutilisation est impossible avec un haché). Cinq demandes sur l'adresse d'un admin, dans la limite par adresse, suffisaient à invalider le code qu'il attendait et à l'empêcher de se connecter. Le code est désormais chiffré en base (`storeOTP: "encrypted"`, XChaCha20-Poly1305 avec une clé dérivée de `BETTER_AUTH_SECRET`) et `resendStrategy: "reuse"` renvoie le code en cours tant qu'il est valide et n'a pas épuisé ses essais, en prolongeant sa validité. Un code épuisé ou expiré est remplacé.

Conséquences :

- la colonne `Verification.value` est en `Text` : la valeur chiffrée (92 caractères hexadécimaux plus le compteur d'essais) y tient sans migration ;
- un code haché encore en attente au moment du déploiement ne se déchiffre pas : une demande ou une saisie sur cette adresse échoue jusqu'à son expiration, au plus 10 minutes ;
- un changement de `BETTER_AUTH_SECRET` invalide de la même façon les codes en attente ;
- le job de mail porte toujours le code en clair : le worker ne lit pas la table `Verification`.

