---
cible: serveur
type: correctif
audience: organisateurs
role: admin-activite
etat: prevu
fr:
  titre: >-
    Une candidature importée garde l'option « Prévenir par mail » de son import
  texte: >-
    Une candidature importée en mode « À répartir », puis acceptée plus tard,
    crée une fiche qui garde l'option « Prévenir par mail » de son import.
    Auparavant, cette fiche avait toujours l'option cochée, et une adresse sur la
    candidature suffisait à envoyer le lien personnel. Une candidature importée
    avant cette version crée une fiche sans l'option. Une candidature importée
    avec un identifiant externe ne rejoint plus par son adresse la fiche d'un
    autre billet.
en:
  titre: >-
    An imported application keeps the "Notify by email" option of its import
  texte: >-
    An application imported in "To place" mode, then accepted later, creates a
    record that keeps the "Notify by email" option of its import. Before, this
    record always received the option, and an email address on the application
    was enough to send the personal link. An application imported before this
    version creates a record without the option. An application imported with an
    external ID no longer joins the record of another ticket by its email
    address.
---

ADR 0042, amendement du 2026-11-13. `accepterSurSequence` (`lib/appels.ts`) lit
`Candidature.prevenirParMail`, nul hors import et faux par défaut pour une
candidature importée avant la migration `20261113120000_option_mail_candidature_import`.
