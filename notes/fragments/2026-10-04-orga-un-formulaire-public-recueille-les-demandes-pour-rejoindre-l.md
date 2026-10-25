---
cible: orga
type: fonctionnalite
audience: organisateurs
role: admin-activite
etat: prevu
version: 0.9.0
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
en:
  titre: >-
    A public form collects requests to join the team
  texte: >-
    In the “Activities” screen, you open your activity’s public form and copy
    its link. A person outside the team fills it in without an account: their
    first and last name, email address, the areas that interest them, their
    availability, and what they can do. You set the introduction text, an
    additional question, and the availability levels. The join request arrives
    in the “Join requests” tab of the “People” screen, with its answers. The
    person receives no email before your decision. The form is closed by
    default.
---

`pages/Rejoindre.tsx` porte la page publique, sous `/rejoindre/<organisation>/<activité>`.
`pages/admin/Activites.tsx` règle le formulaire dans la fenêtre de l'activité, par
`modifierActivite`. `composants/Demandes.tsx` marque les demandes venues du
formulaire et déplie leurs réponses. ADR 0015.
