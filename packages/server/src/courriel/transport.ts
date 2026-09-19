import { createTransport, type Transporter } from 'nodemailer'

import { env, type ReglageSmtp } from '../env.ts'
import { courrielTronque, journal } from '../lib/journal.ts'
import { configurationOrganisation } from '../lib/organisation.ts'

export interface Message {
  destinataire: string
  sujet: string
  html: string
  // La partie texte est obligatoire : sans elle, les filtres anti-spam pénalisent le mail.
  texte: string
  // Page de réglage des mails, pour l'en-tête List-Unsubscribe des résumés.
  desabonnement?: string
}

// parti : accepté par le serveur SMTP ; refuse : refus définitif (5xx) ;
// panne : erreur temporaire, à rejouer ; tu : aucun transport configuré.
export type Issue = 'parti' | 'refuse' | 'panne' | 'tu'

function ouvrir(reglage: ReglageSmtp): Transporter {
  return createTransport({
    host: reglage.hote,
    port: reglage.port,
    secure: reglage.secure,
    ...(reglage.utilisateur === undefined
      ? {}
      : { auth: { user: reglage.utilisateur, pass: reglage.motDePasse } }),
    // Un seul transport mutualisé. OVH plafonne le débit sortant : deux connexions suffisent.
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
}

let principal: Transporter | null = null
let capture: Transporter | null = null

function voiePour(destinataire: string): {
  transport: Transporter | null
  hote?: string
} {
  principal ??= env.COURRIEL === null ? null : ouvrir(env.COURRIEL)
  capture ??=
    env.COURRIEL_CAPTURE === null ? null : ouvrir(env.COURRIEL_CAPTURE)
  const voiePrincipale = { transport: principal, hote: env.COURRIEL?.hote }
  if (capture === null) return voiePrincipale
  return env.COURRIEL_DELIVRABILITE.includes(destinataire.trim().toLowerCase())
    ? voiePrincipale
    : { transport: capture, hote: env.COURRIEL_CAPTURE?.hote }
}

/** Vérifie le SMTP au démarrage du worker, sans bloquer les autres files. */
export async function verifierTransport(): Promise<void> {
  if (env.COURRIEL === null) {
    journal.warn(
      { evenement: 'courriel-sans-transport', appEnv: env.APP_ENV },
      'Aucun SMTP configuré : les mails seront mis en file puis ignorés.'
    )
    return
  }
  principal ??= ouvrir(env.COURRIEL)
  if (env.COURRIEL_CAPTURE !== null) {
    journal.warn(
      {
        evenement: 'courriel-sortie-ouverte',
        nommees: env.COURRIEL_DELIVRABILITE.map(courrielTronque),
      },
      'Essai de délivrabilité : seules les adresses nommées reçoivent vraiment, le reste va dans Mailpit.'
    )
  }
  await principal.verify().then(
    () => {
      journal.info(
        { evenement: 'courriel-transport-pret', hote: env.COURRIEL?.hote },
        'Transport mail prêt.'
      )
    },
    (erreur: unknown) => {
      journal.error(
        {
          evenement: 'courriel-transport-refuse',
          hote: env.COURRIEL?.hote,
          message: String(erreur),
        },
        'Le serveur SMTP a refusé la connexion : vérifier l’hôte, le port et les identifiants.'
      )
    }
  )
}

export async function expedier(
  message: Message,
  transport?: Transporter | null
): Promise<Issue> {
  const voie =
    transport === undefined ? voiePour(message.destinataire) : { transport }
  if (voie.transport === null) {
    journal.debug(
      {
        evenement: 'courriel-tu',
        destinataire: courrielTronque(message.destinataire),
      },
      'Aucun transport : le mail n’est pas envoyé.'
    )
    return 'tu'
  }
  try {
    const info = (await voie.transport.sendMail({
      from: (await configurationOrganisation()).expediteur,
      to: message.destinataire,
      subject: message.sujet,
      html: message.html,
      text: message.texte,
      headers: {
        'Auto-Submitted': 'auto-generated',
        ...(message.desabonnement
          ? { 'List-Unsubscribe': `<${message.desabonnement}>` }
          : {}),
      },
    })) as { messageId?: string }
    journal.info(
      {
        evenement: 'courriel-parti',
        destinataire: courrielTronque(message.destinataire),
        messageId: info.messageId,
        hote: voie.hote,
      },
      'Un mail est parti.'
    )
    return 'parti'
  } catch (erreur) {
    // Un 5xx est un refus définitif : le rejouer abîmerait la réputation du domaine.
    const codeSmtp = (erreur as { responseCode?: number }).responseCode
    const definitif =
      typeof codeSmtp === 'number' && codeSmtp >= 500 && codeSmtp < 600
    journal[definitif ? 'warn' : 'error'](
      {
        evenement: definitif ? 'courriel-refuse' : 'courriel-en-panne',
        destinataire: courrielTronque(message.destinataire),
        codeSmtp: codeSmtp ?? null,
        message: (erreur as Error).message,
      },
      definitif
        ? 'Le serveur distant a refusé définitivement.'
        : 'Envoi impossible, il sera rejoué.'
    )
    return definitif ? 'refuse' : 'panne'
  }
}
