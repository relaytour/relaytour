import { createHmac, timingSafeEqual } from 'node:crypto'

import type { PrismaClient } from '@relaytour/database'

import { avecOrganisation } from './composition-notifications.ts'
import { echapperHtml } from './html.ts'
import { journal } from './journal.ts'
import { avecLangue, i18n, langueDe } from './langue.ts'
import { langueDuDestinataire } from './langue-destinataire.ts'
import { configurationOrganisation } from './organisation.ts'

// Révocation d'un jeton d'accès par le lien de son mail de création (ADR 0064).
//
// Le mail qui annonce un jeton porte un lien de révocation : la personne qui n'est
// pas à l'origine de la création coupe l'accès sans se connecter. Le lien porte
// l'identifiant du jeton, signé par HMAC avec le secret du serveur, sous un préfixe
// propre à cet usage, comme le désabonnement (ADR 0050). Le serveur ne garde rien
// de plus en base, et un lien modifié ne vaut rien. Le GET n'écrit rien : il affiche
// une confirmation, car les filtres des messageries ouvrent les liens des mails. Le
// POST révoque. Un jeton déjà révoqué ou expiré reçoit la même page qu'un lien
// non valide : le lien ne dit rien d'un jeton qui ne répond plus.

/** Le chemin des liens, sous /medias/, que le proxy relaie déjà vers l'API. */
export const CHEMIN_REVOCATION = '/medias/jeton/revocation'

// Le préfixe sépare cet usage des autres signatures du même secret.
const signer = (secret: string, charge: string) =>
  createHmac('sha256', secret)
    .update(`relaytour:revocation-jeton:${charge}`)
    .digest()

/** Le jeton d'un lien : l'identifiant du jeton d'accès en base64url, un point, sa signature. */
export function jetonRevocation(secret: string, jetonAccesId: string): string {
  const charge = Buffer.from(jetonAccesId).toString('base64url')
  return `${charge}.${signer(secret, charge).toString('base64url')}`
}

/** L'identifiant du jeton d'accès qu'un lien désigne, ou null si la signature ne correspond pas. */
export function lireJetonRevocation(
  secret: string,
  jeton: string
): string | null {
  const morceaux = /^([A-Za-z0-9_-]{1,200})\.([A-Za-z0-9_-]{43})$/.exec(jeton)
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
  const jetonAccesId = Buffer.from(charge, 'base64url').toString()
  return /^[a-z0-9]{1,64}$/.test(jetonAccesId) ? jetonAccesId : null
}

export function adresseRevocation(origine: string, jeton: string): string {
  return `${origine.replace(/\/$/, '')}${CHEMIN_REVOCATION}/${jeton}`
}

export interface JetonARevoquer {
  id: string
  nom: string
  apercu: string
  userId: string
  organisationId: string
}

/**
 * Le jeton d'accès encore actif que le lien désigne, ou null : inconnu, révoqué ou
 * expiré. Le lien d'un jeton qui ne répond plus vaut un lien non valide.
 */
export async function jetonARevoquer(
  prisma: PrismaClient,
  jetonAccesId: string,
  maintenant = new Date()
): Promise<JetonARevoquer | null> {
  const jeton = await prisma.jetonAcces.findUnique({
    where: { id: jetonAccesId },
    select: {
      id: true,
      nom: true,
      apercu: true,
      userId: true,
      organisationId: true,
      revoqueLe: true,
      expireLe: true,
    },
  })
  if (
    jeton === null ||
    jeton.revoqueLe !== null ||
    jeton.expireLe.getTime() <= maintenant.getTime()
  ) {
    return null
  }
  return jeton
}

/** Révoque le jeton d'un lien. Rend faux quand il ne répondait déjà plus. */
export async function revoquerParLien(
  prisma: PrismaClient,
  jetonAccesId: string,
  maintenant = new Date()
): Promise<boolean> {
  const { count } = await prisma.jetonAcces.updateMany({
    where: {
      id: jetonAccesId,
      revoqueLe: null,
      expireLe: { gt: maintenant },
    },
    data: { revoqueLe: maintenant },
  })
  if (count === 0) return false
  journal.info(
    { evenement: 'jeton-acces-revoque', jetonId: jetonAccesId, par: 'lien' },
    'Un jeton d’accès a été révoqué par le lien de son mail de création.'
  )
  return true
}

export type EtatPageRevocation = 'confirmer' | 'fait' | 'invalide'

/**
 * La page servie à la personne qui ouvre le lien, dans la langue de son compte
 * (ADR 0047). Un lien non valide ne désigne aucun compte : la page suit alors les
 * langues du navigateur.
 */
export async function pageRevocation(
  prisma: PrismaClient,
  etat: EtatPageRevocation,
  jeton: JetonARevoquer | null,
  navigateur: readonly string[] = []
): Promise<string> {
  const configuration =
    jeton === null
      ? null
      : await configurationOrganisation(jeton.organisationId)
  const langue =
    jeton === null
      ? langueDe(null, null, navigateur)
      : await langueDuDestinataire(prisma, jeton.userId, jeton.organisationId)
  const jetons =
    configuration === null
      ? null
      : `${configuration.origineOrga}${avecOrganisation('/preferences', configuration.slug)}#jetons`
  return avecLangue(langue, () => {
    const valeurs = {
      jeton: echapperHtml(jeton?.nom ?? ''),
      apercu: echapperHtml(jeton === null ? '' : `rt_${jeton.apercu}…`),
      organisation: echapperHtml(configuration?.nom ?? ''),
    }
    const corps =
      etat === 'invalide'
        ? `<h1>${i18n._('Lien non valide')}</h1>
<p>${i18n._('Ce lien de révocation n’est pas valide, ou le jeton qu’il désigne ne répond déjà plus. Vous gérez vos jetons d’accès dans les préférences de l’espace organisateur.')}</p>`
        : etat === 'fait'
          ? `<h1>${i18n._('Jeton révoqué')}</h1>
<p>${i18n._('Le jeton « {jeton} » ({apercu}) de {organisation} ne répond plus. Le programme qui le détenait a perdu son accès.', valeurs)}</p>`
          : `<h1>${i18n._('Révoquer un jeton d’accès')}</h1>
<p>${i18n._('Vous êtes sur le point de révoquer le jeton « {jeton} » ({apercu}) de {organisation}. Le programme qui le détient perdra aussitôt son accès.', valeurs)}</p>
<form method="post">
<button type="submit">${i18n._('Révoquer ce jeton')}</button>
</form>`
    const lien =
      jetons === null
        ? ''
        : `<p><a href="${echapperHtml(jetons)}">${i18n._('Gérer mes jetons d’accès')}</a></p>`
    return `<!doctype html>
<html lang="${langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${i18n._('Révocation d’un jeton d’accès')}</title>
<style>
body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; background: #F4F5F6; color: #1A1F24; margin: 0; padding: 48px 16px; }
main { max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; padding: 28px 24px; }
h1 { font-size: 20px; margin: 0 0 16px; }
p { font-size: 15px; line-height: 24px; margin: 0 0 16px; }
button { font: inherit; font-weight: 700; color: #FFFFFF; background: #B0283F; border: 0; border-radius: 10px; padding: 13px 24px; cursor: pointer; }
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
  })
}
