---
cible: orga
type: correctif
audience: organisateurs
role: referent
etat: prevu
version: 0.4.1
fr:
  titre: >-
    Le sélecteur d'activité passe dans la barre latérale
  texte: >-
    La barre latérale affiche le logo et le sigle de l'activité que vous
    consultez. Un bouton à côté du sigle ouvre la liste des autres activités de
    votre organisation, sur ordinateur comme dans le menu de la vue mobile. La
    barre de recherche occupe de nouveau toute la largeur de la barre haute. Le
    nom de votre organisation reste rappelé au-dessus de l'activité, et la
    signature du pied tient en trois mots, « Propulsé par Relaytour », dont le
    nom mène au code source.
en:
  titre: >-
    The activity selector moves to the sidebar
  texte: >-
    The sidebar shows the logo and acronym of the activity you are viewing. A
    button next to the acronym opens the list of your organization’s other
    activities, on desktop and in the mobile menu. The search bar again spans
    the full width of the top bar. Your organization’s name stays above the
    activity, and the footer signature has three words, “Powered by Relaytour”,
    where the name links to the source code.
---

Le sélecteur quitte la barre haute pour le nouveau composant `ChoixActivite`,
posé en tête de la barre latérale et du tiroir de la vue mobile. Il s'efface
quand l'organisation ne porte qu'une activité. `SignatureRelaytour` perd son
lien « code source » : le mot « Relaytour » le porte (ADR 0009 mis à jour).
