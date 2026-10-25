---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.20.0
fr:
  titre: >-
    Les admins de l'activité fusionnent les fiches bénévoles en double
  texte: >-
    L'onglet « Doublons possibles » de l'écran « Bénévoles » rapproche les
    fiches qui portent la même adresse, le même téléphone ou un nom proche.
    Vous choisissez le nom, l'adresse et le téléphone gardés. Relaytour réunit
    ensuite les places, les disponibilités et les candidatures des deux fiches.
    Une paire écartée ne revient plus.
en:
  titre: >-
    Activity admins merge duplicate volunteer records
  texte: >-
    The “Possible duplicates” tab of the “Volunteers” screen matches records
    that have the same email address, the same phone number, or a similar name.
    You choose which name, email address, and phone number to keep. Relaytour
    then combines the places, availability, and applications of both records. A
    pair you dismiss does not come back.
---

ADR 0042 : requête `doublonsBenevoles`, mutations `fusionnerBenevoles` et
`marquerBenevolesDistincts` ; table `PaireDistincte`.
