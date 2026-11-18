---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.32.0
fr:
  titre: >-
    Une application tierce demande l'accès par OAuth, avec l'accord de la personne
  texte: >-
    Une application (Zapier, n8n, un script) peut demander l'accès à une organisation
    sans jeton copié. La personne se connecte, lit ce que l'application demande, puis
    accepte ou refuse. L'application reçoit des jetons d'une heure, renouvelés pendant
    90 jours, avec les bornes d'un jeton d'accès. L'installation publie ses métadonnées
    OAuth 2.1 et lit le document de métadonnées de chaque application. L'exploitant
    règle la fonction par `APPLICATIONS_TIERCES` et refuse une application par
    `APPLICATIONS_REFUSEES`.
---

ADR 0067, étage serveur. Points /oauth/autoriser, /oauth/jeton, /oauth/revocation,
/oauth/enregistrement (fermé par défaut) et documents /.well-known/oauth-*. Une
autorisation est une ligne JetonAcces liée à un ClientApplication ; les jetons rto_
et rtr_ vivent dans JetonApplication. Migration additive.
