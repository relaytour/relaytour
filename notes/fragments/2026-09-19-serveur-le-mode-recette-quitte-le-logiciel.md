---
cible: serveur
type: rupture
audience: interne
etat: prevu
version: 0.4.0
fr:
  titre: >-
    Le mode recette quitte le logiciel
  texte: >-
    APP_ENV ne connaît plus que local et prod. Les variables
    COURRIEL_DELIVRABILITE et COURRIEL_CAPTURE disparaissent, ainsi que le
    service Mailpit de la pile de référence. Hors du poste local,
    l'application parle au SMTP renseigné, et à rien d'autre.
  migration: >-
    Une installation d'essai passe en APP_ENV=prod et pointe
    COURRIEL_SMTP_HOTE sur une boîte de capture qu'elle déclare elle-même,
    dans sa surcharge Compose. Retirer COURRIEL_DELIVRABILITE du .env.
---

- `env.ts` : `APP_ENV` en `local | prod`, plus de voie de capture ni de
  routage par liste d'adresses ; `transport.ts` n'a plus qu'un transport.
- `infra/compose` : service `mailpit`, volume et profil `courriel` retirés.
- Une convention à deux environnements relève de l'exploitant (ADR 0007).
