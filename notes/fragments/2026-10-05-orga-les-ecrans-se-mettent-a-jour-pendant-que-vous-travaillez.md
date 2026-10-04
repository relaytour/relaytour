---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Les écrans se mettent à jour pendant que vous travaillez
  texte: >-
    Les tâches, l'avancement, les fiches, l'équipe et la cloche se relisent
    quand vous revenez sur l'onglet, quand le réseau revient, et chaque minute
    tant que l'onglet est visible. Vous voyez ainsi les changements des autres
    personnes sans recharger la page. L'écran garde son contenu pendant la
    relecture, et l'éditeur de fiche garde votre texte.
---

`lib/rafraichissement.ts` relit en silence les requêtes de `REQUETES_RAFRAICHIES`
(`client.query` en `network-only`, sans `refetch()`), au plus toutes les quinze
secondes. Une panne de réseau laisse l'écran tel quel ; un refus du serveur
s'affiche. Les écrans concernés testent `loading && !data`. Le `pollInterval` de la
cloche disparaît.
