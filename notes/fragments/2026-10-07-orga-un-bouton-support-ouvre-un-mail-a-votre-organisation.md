---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.11.0
fr:
  titre: >-
    Un bouton Support ouvre un mail à votre organisation
  texte: >-
    Le menu du compte propose l'entrée « Support » quand votre organisation a
    déclaré une adresse de support. L'entrée ouvre un mail à cette adresse dans
    votre messagerie. L'objet du mail indique l'organisation et la version de
    Relaytour. Sans adresse déclarée, l'entrée ouvre le mail ou la page
    d'assistance de votre hébergeur, s'il en a réglé une. Elle n'apparaît pas
    quand aucune des deux n'existe.
en:
  titre: >-
    A Support button opens an email to your organization
  texte: >-
    The account menu offers a “Support” entry when your organization has
    declared a support address. The entry opens an email to that address in your
    mail app. The subject of the email states the organization and the Relaytour
    version. Without a declared address, the entry opens the email or the
    support page of your host, if it has set one. It does not appear when
    neither exists.
---

- Champ `support` de l'organisation, `lib/support.ts`. Sans adresse déclarée,
  le lien vient de `SUPPORT_URL` s'il est réglé.
