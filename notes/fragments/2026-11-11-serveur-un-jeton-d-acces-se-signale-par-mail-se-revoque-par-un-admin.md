---
cible: serveur
type: rupture
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Un jeton d'accès se signale par mail, se révoque par un admin et n'ouvre la gestion des membres que sur demande
  texte: >-
    À la création d'un jeton d'accès, la personne au nom de qui il agit reçoit un
    mail qui en donne la portée et un lien pour le révoquer sans se connecter. Un
    admin de l'organisation voit tous les jetons de ses membres et les révoque ;
    la personne l'apprend par mail. Chacun peut révoquer tous ses jetons d'un
    geste. Un jeton n'invite, n'affecte, ne retire ni ne promeut plus personne, sauf
    s'il a été créé avec la gestion des membres. Le contrat de l'API REST ne donne plus
    la version de l'installation, et le débit d'un jeton reste borné quand le
    cache ne répond pas.
  migration: >-
    Les jetons d'accès existants n'ouvrent plus la gestion des membres. Un
    programme qui invite, affecte, retire ou promeut des personnes avec un jeton reçoit
    désormais PORTEE_INSUFFISANTE : sa personne crée un nouveau jeton en cochant
    « Ce jeton peut inviter, retirer et promouvoir des membres », puis révoque
    l'ancien. Aucune action en base.
en:
  titre: >-
    An access token is announced by email, can be revoked by an admin and only manages members on request
  texte: >-
    When an access token is created, the person it acts for receives an email
    stating its scope and a link to revoke it without signing in. An
    organization admin sees every member's tokens and revokes them; the person
    is told by email. Anyone can revoke all their tokens at once. A token no
    longer invites, assigns, removes or promotes anyone unless it was created
    with member management. The REST API contract no longer gives the installation's
    version, and a token's rate stays bounded when the cache is down.
  migration: >-
    Existing access tokens no longer open member management. A program that
    invites, assigns, removes or promotes people with a token now receives
    PORTEE_INSUFFISANTE: its person creates a new token with "This token can
    invite, remove and promote members" checked, then revokes the old one. No
    database action.
---

Audit de sécurité du 11 novembre 2026 (ADR 0064, section « Sécurité »). Serveur :
`lib/revocation-jeton.ts` signe le lien de révocation et sert sa page sous
`/medias/jeton/revocation/` ; les mails `jeton-cree` et `jeton-revoque` ne sont jamais
reportés ; la portée `gestionMembres` du builder couvre `inviterPersonne`,
`accepterDemande`, `archiverPersonne`, `modifierPersonne`, `definirAdminActivite`,
`rattacherALActivite`, `retirerDeLActivite`, `affecter`, `retirerAffectation`,
`importerEquipe`, `relancerInvitation` et `retirerInvitation`, et
`schema/portees.test.ts` fige les listes ; `jetonsAccesOrganisation`,
`revoquerJetonOrganisation` et `revoquerMesJetonsAcces` ; `openapi.json` porte la
version du contrat ; la limite de débit d'un jeton refuse sans Redis. Migration
additive : `JetonAcces.gestionMembres` et `JetonAcces.revoqueParId`.
