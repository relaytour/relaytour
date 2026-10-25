---
cible: serveur
type: fonctionnalite
audience: organisateurs
role: referent
etat: prevu
version: 0.9.0
fr:
  titre: >-
    Deux personnes ne s'écrasent plus sur une fiche ou un périmètre
  texte: >-
    Quand une autre personne a enregistré une fiche pendant votre rédaction,
    l'éditeur garde votre texte et vous le dit. Vous consultez la version
    actuelle, vous copiez votre texte, ou vous écrasez la version actuelle avec
    le vôtre. L'éditeur garde aussi votre texte en brouillon dans votre
    navigateur : une page rechargée ne le perd plus. Le réglage d'un périmètre
    et la restauration d'une version de fiche signalent le même conflit.
en:
  titre: >-
    Two people no longer overwrite each other on a sheet or an area
  texte: >-
    When another person has saved a sheet while you were writing, the editor
    keeps your text and tells you. You view the current version, copy your text,
    or overwrite the current version with yours. The editor also keeps your text
    as a draft in your browser: a reloaded page no longer loses it. An area’s
    settings and the restoration of a sheet version report the same conflict.
---

`modifierFiche` et `restaurerVersionFiche` reçoivent `versionDeDepart` ;
`modifierPerimetre` reçoit `versionAttendue` (`Perimetre.version`, migration
additive `20261005090000_version_des_perimetres`). Un écart lève
`CONFLIT_VERSION`, avec `versionCourante`, `modifieeLe` et, pour une fiche,
`modifieePar`. Sans version, la dernière écriture gagne. L'import du contenu
compte comme une modification d'un périmètre. Le brouillon de l'éditeur vit dans
`localStorage` (`lib/brouillon.ts`) et s'efface à l'enregistrement, à l'abandon et
à la déconnexion.
