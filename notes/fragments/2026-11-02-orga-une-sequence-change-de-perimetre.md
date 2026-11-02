---
cible: orga
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
fr:
  titre: >-
    Une séquence peut changer de périmètre
  texte: >-
    La fenêtre « Modifier la séquence » propose maintenant le champ « Périmètre ».
    Vous pouvez y placer la séquence dans un autre périmètre où vous écrivez, ou
    dans toute l'activité si vous en êtes admin. La séquence garde ses places, son
    lieu et ses consignes. Un appel à bénévoles ouvert sur cette séquence passe
    dans le nouveau périmètre.
en:
  titre: >-
    A slot can move to another area
  texte: >-
    The "Edit the slot" window now shows the "Area" field. You can move the slot to
    another area where you can write, or to the whole activity if you are one of
    its admins. The slot keeps its places, its venue and its instructions. A
    volunteer call opened on this slot moves to the new area.
---

`modifierSequence` reçoit `perimetreId` : absent, la séquence garde son périmètre ;
null, elle passe dans toute l'activité. Le changement exige l'écriture dans l'ancien et
dans le nouveau périmètre, et met à jour `AppelBenevoles.perimetreId` des appels de
portée `SEQUENCE`.
