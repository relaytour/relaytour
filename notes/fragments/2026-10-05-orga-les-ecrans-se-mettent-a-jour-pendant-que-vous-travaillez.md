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
    relecture, et l'éditeur de fiche garde votre texte. Quand vos accès
    changent ou que votre session prend fin, un avis vous propose de recharger
    la page.
---

`lib/rafraichissement.ts` relit en silence les requêtes de `REQUETES_RAFRAICHIES`
(`client.query` en `no-cache`, puis `writeQuery`, sans `refetch()`), au plus toutes
les quinze secondes. Une panne laisse l'écran tel quel. Un refus (`FORBIDDEN`, ou
`moi` nul) n'écrit rien dans le cache : `composants/AvisRelecture.tsx` l'annonce
dans la coquille. Les écrans concernés testent `loading && !data`. Le
`pollInterval` de la cloche disparaît.
