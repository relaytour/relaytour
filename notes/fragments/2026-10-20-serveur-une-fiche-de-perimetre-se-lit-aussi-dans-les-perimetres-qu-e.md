---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
fr:
  titre: >-
    Une fiche de périmètre se lit aussi dans les périmètres qu’elle concerne
  texte: >-
    Une fiche de périmètre porte une liste « Concerne aussi » : des périmètres et
    des groupes de son activité. Les référentes et référents de ces périmètres
    lisent la fiche sans la modifier. Une déclinaison acceptée rend aussi
    connexe la fiche de sa tâche partagée. Un périmètre cible masque une fiche
    connexe de sa liste. Le dossier de contenu porte la liste dans les clés
    `concerne` et `concerneGroupes` de l’en-tête de la fiche.
---

ADR 0039. Migration additive `20261020135634_fiches_connexes` : tables
`FicheConnexe`, `FicheGroupeConnexe` et `FicheConnexeMasquee`, valeurs
`FICHE_CONNEXE` de `TypeNotification`, `FICHE_CONNEXE_MASQUEE` et
`FICHE_CONNEXE_AFFICHEE` de `TypeJournal`. Champs `concerneAussi`,
`concerneGroupes` et `connexions` de `Fiche`, `fichesConnexes` et
`peutMasquerFichesConnexes` de `Perimetre`. Mutations `reglerConcerneAussi`,
`masquerFicheConnexe` et `afficherFicheConnexe`. La lecture d'une fiche
(`peutLireFiche`), la liste `fiches`, la recherche et `Tache.fiche` suivent le
partage. Une déclinaison cite la fiche de sa tâche partagée, même une fiche du
périmètre d'origine (règle de l'ADR 0026 remplacée). Le retrait d'un groupe de
l'activité le retire des listes. L'export complet porte les listes et les
masquages.
