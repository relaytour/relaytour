---
cible: serveur
type: securite
audience: organisateurs
role: admin-organisation
etat: prevu
fr:
  titre: >-
    La purge nocturne retire les données techniques échues et les images sans usage
  texte: >-
    Chaque nuit, le serveur supprime les sessions et les codes de connexion expirés,
    les compteurs de la veille, les notifications lues depuis plus de 90 jours, et
    les images que l'identité de l'organisation ou d'une activité ne cite plus
    depuis 30 jours. Une organisation garde 50 images au plus ; au-delà, l'écran
    « Organisation » refuse une nouvelle image et renvoie à cette purge.
---

`lib/purge.ts` : `purgerDonneesTechniques` (Session, Verification, RateLimit,
Notification lue) et `purgerMedias` (empreintes absentes des JSON `configuration`
et `identite`, `createdAt` de plus de 30 jours). Appelées par le job `purge`
après `purgerDemandes`. Les notifications non lues et le journal des actions
restent. Test `purge.integration.test.ts`.
