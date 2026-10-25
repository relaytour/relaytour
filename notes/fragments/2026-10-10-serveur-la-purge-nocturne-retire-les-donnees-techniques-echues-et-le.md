---
cible: serveur
type: securite
audience: organisateurs
role: admin-organisation
etat: prevu
version: 0.17.0
fr:
  titre: >-
    La purge nocturne retire les données techniques échues et les images sans usage
  texte: >-
    Chaque nuit, le serveur supprime les sessions et les codes de connexion expirés,
    les compteurs de la veille, les notifications lues depuis plus de 90 jours, et
    les images que l'identité de l'organisation ou d'une activité ne cite plus
    depuis 30 jours (la purge note la date à laquelle une image cesse d'être citée). Une organisation garde 50 images au plus ; au-delà, l'écran
    « Organisation » refuse une nouvelle image et renvoie à cette purge.
en:
  titre: >-
    The nightly purge removes expired technical data and unused images
  texte: >-
    Every night, the server deletes expired sessions and sign-in codes, the
    previous day’s counters, notifications read more than 90 days ago, and
    images that the identity of the organization or of an activity has not cited
    for 30 days (the purge records the date an image stops being cited). An
    organization keeps at most 50 images. Beyond that, the “Organization” screen
    refuses a new image and points to this purge.
---

`lib/purge.ts` : `purgerDonneesTechniques` (Session, Verification, RateLimit,
Notification lue) et `purgerMedias` (empreintes absentes des JSON `configuration`
et `identite` ; colonne `orphelinDepuis` posée au premier passage sans citation,
effacée si l'image est citée de nouveau, suppression 30 jours après ; migration
additive `medias_orphelins`). Appelées par le job `purge`
après `purgerDemandes`. Les notifications non lues et le journal des actions
restent. Test `purge.integration.test.ts`.
