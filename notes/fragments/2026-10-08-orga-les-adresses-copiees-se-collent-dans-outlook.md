---
cible: orga
type: correctif
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Les adresses copiées se collent dans Outlook
  texte: >-
    Outlook ne découpait pas plusieurs adresses copiées depuis la fenêtre
    « Écrire un message », parce qu'une virgule les séparait. Les adresses se
    copient maintenant avec un point-virgule quand vous avez choisi Outlook, et
    avec une virgule pour les autres messageries. Le choix « Séparateur des
    adresses », sous les boutons de copie, change ce signe pour un message.
    Pour la messagerie par défaut de l'appareil, vos préférences fixent le
    signe proposé.
---

`adressesACopier` reçoit le séparateur. Chaque cible de `lib/messagerie.ts`
déclare le sien (`;` pour les trois cibles Outlook) ; la messagerie par défaut
suit le réglage gardé dans `localStorage` (`relaytour.messagerie.separateur`).
Composant `CopierAdresses`, partagé par la fenêtre de rédaction et par la
réouverture d'un message. Le lien d'ouverture ne change pas : il sépare les
adresses par une virgule, comme le veut la RFC 6068.
