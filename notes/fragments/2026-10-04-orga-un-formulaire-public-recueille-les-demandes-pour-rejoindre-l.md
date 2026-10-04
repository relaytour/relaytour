---
cible: orga
type: fonctionnalite
audience: organisateurs
etat: prevu
fr:
  titre: >-
    Un formulaire public recueille les demandes pour rejoindre l'équipe
  texte: >-
    Dans l'écran « Activités », vous ouvrez le formulaire public de votre
    activité et copiez son adresse. Une personne extérieure le remplit sans
    compte : son prénom et son nom, son adresse, les périmètres qui
    l'intéressent, sa disponibilité et ce qu'elle sait faire. Vous réglez le
    texte d'introduction, une question complémentaire et les paliers de
    disponibilité. La demande arrive dans l'onglet « Demandes » de l'écran
    « Personnes », avec ses réponses. La personne ne reçoit aucun mail avant
    votre décision. Le formulaire est fermé par défaut.
---

`pages/Rejoindre.tsx` porte la page publique, sous `/rejoindre/<organisation>/<activité>`.
`pages/admin/Activites.tsx` règle le formulaire dans la fenêtre de l'activité, par
`modifierActivite`. `composants/Demandes.tsx` marque les demandes venues du
formulaire et déplie leurs réponses. ADR 0015.
