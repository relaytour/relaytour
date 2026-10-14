---
cible: serveur
type: securite
audience: public
etat: prevu
fr:
  titre: >-
    L'archivage d'une personne ne vaut que dans son organisation
  texte: >-
    Un admin qui archive une personne lui ferme l'accès à son organisation
    seulement. La personne garde son compte, se connecte encore et reste membre de
    ses autres organisations, qui n'apprennent rien de cet archivage. Le nom
    appartient à la personne : elle le modifie dans ses préférences, et un admin
    ne le corrige que tant qu'elle ne s'est jamais connectée. Sur une
    installation qui porte une seule organisation, une personne archivée reçoit
    encore son code de connexion. Elle se connecte alors sans accès à aucune
    donnée, et l'application lui indique qu'elle n'appartient à aucune
    organisation ouverte.
---

ADR 0031. Colonne `Appartenance.archiveLe` (migration additive, reprise des
comptes déjà archivés dans chacune de leurs appartenances). `User.archivedAt`
reste en base sous le nom Prisma `sansAppartenanceActiveLe` : le serveur l'écrit
quand la personne n'a plus aucune appartenance active, pour qu'une version
antérieure la refuse encore après un retour arrière. La connexion ne dépend plus
de l'archivage et aucune session n'est fermée : le contexte relit l'appartenance
à chaque requête. Les mails, les notifications push, les rappels et les résumés
filtrent sur l'archivage dans l'organisation concernée. `archiverPersonne` et
`modifierPersonne` ne refusent plus un compte membre d'une autre organisation.
`affecter`, `definirAdminActivite`, `accorderDroitRedaction` et la promotion par
`modifierPersonne` refusent une personne archivée dans l'organisation. Un verrou
sur la ligne du compte ordonne deux archivages simultanés.
Nouvelle mutation `modifierMonNom`, nouveau champ `Personne.nomModifiable`.
