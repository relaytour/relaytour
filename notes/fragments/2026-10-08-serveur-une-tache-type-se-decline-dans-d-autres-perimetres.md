---
cible: serveur
type: fonctionnalite
audience: public
etat: prevu
version: 0.14.0
fr:
  titre: >-
    Une tâche type se décline dans d'autres périmètres
  texte: >-
    Dans un dossier de contenu, une tâche type accepte une clé `declinaison`.
    Elle désigne un groupe de périmètres ou une liste de périmètres. L'import
    crée alors la tâche dans son périmètre, puis une déclinaison dans chaque
    périmètre cible. Chaque déclinaison garde son statut, ses personnes
    assignées et son échéance. Un périmètre cible qui porte déjà une tâche de
    même modèle la garde : l'import la rattache à sa tâche partagée et le
    signale. Un contenu existant reste valide sans changement.
---

ADR 0026. Colonnes `Tache.origineId`, `accord`, `accordParId` et `accordLe`,
index unique sur `(origineId, perimetreId)`. La validation refuse un groupe non
déclaré, une cible inconnue, le périmètre d'origine, une fiche de périmètre et
un modèle que le périmètre cible déclare déjà. Le rapport d'import gagne la
liste `rattachees`. L'export complet d'une organisation porte l'origine et
l'accord de chaque tâche.
