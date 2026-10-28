---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.23.0
fr:
  titre: >-
    L'avis de nouvelle version ne s'affiche plus après un rechargement
  texte: >-
    Quand vous rechargez la page après une mise à jour, l'application utilise
    déjà la dernière version. L'avis « Une nouvelle version est disponible »
    ne vous demande donc plus de recharger une seconde fois.
en:
  titre: >-
    The new version notice no longer appears after a reload
  texte: >-
    When you reload the page after an update, the app already runs the latest
    version. The "A new version is available" notice no longer asks you to
    reload a second time.
---

Une navigation passe par le réseau : la page rechargée est la nouvelle, alors
que l'ancien service worker la contrôle encore et que le nouveau attend. La
page annonçait tout service worker en attente. Elle lui demande désormais les
fichiers de sa coquille (message `COQUILLE`) et n'affiche l'avis que si un de
ses scripts ou de ses styles n'y figure pas. Sans réponse en deux secondes,
l'avis s'affiche comme avant.
