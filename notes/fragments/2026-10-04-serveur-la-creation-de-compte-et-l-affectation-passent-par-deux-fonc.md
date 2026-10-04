---
cible: serveur
type: interne
audience: interne
etat: prevu
fr:
  titre: >-
    La création de compte et l'affectation passent par deux fonctions partagées
  texte: >-
    L'invitation par un admin, l'import d'une équipe et l'invitation du premier
    admin créent ou rattachent un compte par la même fonction. L'affectation
    par un admin et l'import créent leurs affectations par une seconde
    fonction. Les deux écrivent dans le client ou la transaction de l'appelant.
    Le comportement ne change pas.
---

`creerOuRattacherCompte` (`lib/comptes.ts`) renvoie `cree`, `rattache`, `membre`
ou `archive`, et n'écrit rien dans les deux derniers cas. `creerAffectations`
(`lib/affectations.ts`) crée les affectations manquantes et laisse les autres
telles quelles. `inviterPersonne` écrit désormais le compte et ses souhaits dans
une transaction explicite, puis relit la personne. `affecter` refuse toujours une
affectation déjà présente, avec le même message. Chaque appelant garde ses
contrôles d'accès, ses messages d'erreur et ses mails.
