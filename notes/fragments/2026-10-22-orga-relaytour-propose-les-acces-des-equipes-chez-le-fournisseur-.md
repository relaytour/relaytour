---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    Relaytour propose les accès des équipes chez le fournisseur cloud
  texte: >-
    Avec la gestion des accès, un dossier lié propose un partage du dossier, ou
    l'entrée dans un groupe du fournisseur qui a déjà un droit sur lui. Quand
    une équipe change, Relaytour propose d'ajouter les personnes attendues sans
    accès et de retirer les accès qu'il a créés pour des personnes parties. Vous
    appliquez ou écartez chaque proposition depuis l'onglet « Vérification des
    accès ». Un réglage du dossier applique les ajouts sans attendre. Un retrait
    attend toujours un admin, et un accès posé à la main n'est jamais retiré.
    Une notification d'admin annonce les propositions, une fois par jour au
    plus.
---

ADR 0044 : champs `DossierLie.accesFournisseur`, `groupeFournisseurId`,
`groupeFournisseurNom`, `roleFournisseur`, `ajoutsAutomatiques` et
`invitationFournisseur`, tables `PropositionAcces` et `PermissionCreee`, type de
notification `ACCES_FOURNISSEUR_A_VALIDER` (famille « équipe »). La portée
`GESTION` demande `GroupMember.ReadWrite.All` chez Microsoft. Le partage passe
par `driveItem/invite`, le groupe par `members/$ref`. Un signal `EQUIPE` et
l'archivage d'une personne planifient la vérification. Mutations
`reglerAccesFournisseur`, `appliquerPropositionAcces`,
`appliquerPropositionsDossier` et `ecarterPropositionAcces`, requête
`groupesDuDossier`, réservées aux admins de l'organisation. L'export complet
reprend les propositions et les droits créés.
