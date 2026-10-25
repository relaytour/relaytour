import { createHmac, timingSafeEqual } from 'node:crypto'

import type { PrismaClient } from '@relaytour/database'

import { avecOrganisation } from './composition-notifications.ts'
import { echapperHtml } from './html.ts'
import { configurationOrganisation } from './organisation.ts'

// Désabonnement en un clic (ADR 0050, RFC 8058).
//
// Chaque mail désactivable porte une adresse propre à une personne, une organisation
// et une sorte de mail. Le jeton est signé par HMAC avec le secret du serveur, sous
// un préfixe propre à cet usage, comme les liens de l'ADR 0041. Le serveur ne garde
// rien en base, et un jeton modifié ne vaut rien. Changer le secret du serveur
// invalide les adresses des mails déjà envoyés.
// Le POST du jeton désactive la préférence correspondante, sans session. Le GET
// n'écrit rien : il affiche une page de confirmation, car les filtres de sécurité
// des messageries ouvrent les liens des mails.

/** Les mails désactivables, la préférence que chacun coupe et son libellé. */
export const MAILS_DESABONNABLES = {
  'tache-modifiee': {
    libelle: 'Modification de vos tâches',
    reglage: { mailModification: false },
  },
  'rappels-echeance': {
    libelle: 'Échéances',
    reglage: { mailEcheance: false },
  },
  resume: {
    libelle: 'Résumé par mail',
    reglage: { frequenceResume: 'AUCUN' },
  },
  demandes: {
    libelle: 'Demandes pour rejoindre l’équipe',
    reglage: { mailDemandes: false },
  },
} as const

export type MailDesabonnable = keyof typeof MAILS_DESABONNABLES

export interface Desabonnement {
  sorte: MailDesabonnable
  userId: string
  organisationId: string
}

/** Le chemin des adresses, sous /medias/, que le proxy relaie déjà vers l'API. */
export const CHEMIN_DESABONNEMENT = '/medias/desabonnement'

// Le préfixe sépare cet usage des autres signatures du même secret (ADR 0041).
const signer = (secret: string, charge: string) =>
  createHmac('sha256', secret)
    .update(`relaytour:desabonnement:${charge}`)
    .digest()

const estDesabonnable = (sorte: string): sorte is MailDesabonnable =>
  Object.hasOwn(MAILS_DESABONNABLES, sorte)

/** Le jeton d'une adresse : la charge en base64url, un point, sa signature. */
export function jetonDesabonnement(secret: string, d: Desabonnement): string {
  const charge = Buffer.from(
    [d.sorte, d.userId, d.organisationId].join(' ')
  ).toString('base64url')
  return `${charge}.${signer(secret, charge).toString('base64url')}`
}

/** Le désabonnement qu'un jeton désigne, ou null si sa signature ne correspond pas. */
export function lireJetonDesabonnement(
  secret: string,
  jeton: string
): Desabonnement | null {
  const morceaux = /^([A-Za-z0-9_-]{1,400})\.([A-Za-z0-9_-]{43})$/.exec(jeton)
  if (morceaux === null) return null
  const [, charge = '', signature = ''] = morceaux
  const attendue = signer(secret, charge)
  const presentee = Buffer.from(signature, 'base64url')
  if (
    presentee.length !== attendue.length ||
    !timingSafeEqual(presentee, attendue)
  ) {
    return null
  }
  const [sorte = '', userId, organisationId, ...reste] = Buffer.from(
    charge,
    'base64url'
  )
    .toString()
    .split(' ')
  if (
    !estDesabonnable(sorte) ||
    !userId ||
    !organisationId ||
    reste.length > 0
  ) {
    return null
  }
  return { sorte, userId, organisationId }
}

export function adresseDesabonnement(origine: string, jeton: string): string {
  return `${origine.replace(/\/$/, '')}${CHEMIN_DESABONNEMENT}/${jeton}`
}

/**
 * Coupe la préférence d'un mail dans l'organisation du jeton (ADR 0032). Renvoie
 * faux quand le compte ou l'organisation n'existent plus.
 */
export async function desabonner(
  prisma: PrismaClient,
  d: Desabonnement
): Promise<boolean> {
  const [user, organisation] = await Promise.all([
    prisma.user.findUnique({ where: { id: d.userId }, select: { id: true } }),
    prisma.organisation.findUnique({
      where: { id: d.organisationId },
      select: { id: true },
    }),
  ])
  if (user === null || organisation === null) return false
  const { reglage } = MAILS_DESABONNABLES[d.sorte]
  await prisma.preferenceOrganisation.upsert({
    where: {
      userId_organisationId: {
        userId: d.userId,
        organisationId: d.organisationId,
      },
    },
    update: reglage,
    create: {
      userId: d.userId,
      organisationId: d.organisationId,
      ...reglage,
    },
  })
  return true
}

export type EtatPage = 'confirmer' | 'fait' | 'invalide'

/** La page servie à une personne qui ouvre l'adresse dans un navigateur. */
export async function pageDesabonnement(
  etat: EtatPage,
  d: Desabonnement | null
): Promise<string> {
  const configuration =
    d === null ? null : await configurationOrganisation(d.organisationId)
  const libelle = d === null ? '' : MAILS_DESABONNABLES[d.sorte].libelle
  const organisation = configuration?.nom ?? ''
  const preferences =
    configuration === null
      ? null
      : `${configuration.origineOrga}${avecOrganisation('/preferences', configuration.slug)}`
  const corps =
    etat === 'invalide'
      ? `<h1>Lien non valide</h1>
<p>Ce lien de désabonnement n’est pas valide. Vous réglez vos mails dans les préférences de l’espace organisateur.</p>`
      : etat === 'fait'
        ? `<h1>Désabonnement enregistré</h1>
<p>Vous ne recevrez plus les mails « ${echapperHtml(libelle)} » de ${echapperHtml(organisation)}.</p>
<p>Vous pouvez les réactiver dans vos préférences.</p>`
        : `<h1>Se désabonner</h1>
<p>Vous ne recevrez plus les mails « ${echapperHtml(libelle)} » de ${echapperHtml(organisation)}.</p>
<form method="post">
<input type="hidden" name="List-Unsubscribe" value="One-Click">
<button type="submit">Confirmer le désabonnement</button>
</form>`
  const lien =
    preferences === null
      ? ''
      : `<p><a href="${echapperHtml(preferences)}">Gérer vos préférences</a></p>`
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Désabonnement</title>
<style>
body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; background: #F4F5F6; color: #1A1F24; margin: 0; padding: 48px 16px; }
main { max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; padding: 28px 24px; }
h1 { font-size: 20px; margin: 0 0 16px; }
p { font-size: 15px; line-height: 24px; margin: 0 0 16px; }
button { font: inherit; font-weight: 700; color: #FFFFFF; background: #1A1F24; border: 0; border-radius: 10px; padding: 13px 24px; cursor: pointer; }
a { color: #1A1F24; }
</style>
</head>
<body>
<main>
${corps}
${lien}
</main>
</body>
</html>
`
}
