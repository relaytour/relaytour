---
cible: serveur
type: securite
audience: public
etat: prevu
fr:
  titre: >-
    La bibliothèque d'envoi des mails est mise à jour
  texte: >-
    Le serveur passe à la version 10 de nodemailer, qui corrige deux failles de
    déni de service dans l'analyse des adresses (GHSA-v53p-9fqp-m79j et
    GHSA-prgh-xp8r-p3m5) et trois faiblesses de gravité modérée. Les mails partent
    comme avant ; aucune action n'est attendue des installations.
---

Les adresses passées à nodemailer sont relues en base et validées avant l'envoi,
ce qui limitait l'exposition. La version 10 fournit ses propres types :
`@types/nodemailer` quitte les dépendances de développement.
