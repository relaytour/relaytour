import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'

import type { PrismaClient } from '@relaytour/database'
import type { Transporter } from 'nodemailer'

import { composer } from '../courriel/messages.ts'
import { expedier } from '../courriel/transport.ts'
import { env } from '../env.ts'

import { erreurSaisie } from './erreurs.ts'
import { ecrireExport } from './export.ts'
import { journal } from './journal.ts'
import { avecLangue, i18n } from './langue.ts'
import { langueDuDestinataire } from './langue-destinataire.ts'
import { reserverEnvoi, rendreEnvoi } from './plafond-courriel.ts'
import { adresseDuRappel } from './rappel-adresses.ts'

// Export pour un admin d'une installation en sommeil (ADR 0057).
//
// La pile d'une installation en sommeil est arrêtée. Pour un export, l'hébergeur la
// réveille brièvement, sans le worker, et appelle deux mutations d'administration :
// la première écrit l'export et tire un jeton, la seconde envoie le lien de
// téléchargement aux admins. L'hébergeur transmet une adresse et n'apprend rien
// d'autre que l'absence d'export : il ne lit aucune donnée de l'organisation.

/** Un export demandé par un admin au plus par organisation et par 24 heures. */
export const INTERVALLE_EXPORTS_SECONDES = 86_400
// Le script appelle la seconde mutation juste après la première : une heure suffit.
const DUREE_DU_JETON_SECONDES = 3_600

interface ExportPrepare {
  organisationId: string
  /** Les comptes qui recevront le lien, relus à l'envoi. */
  destinataires: string[]
  /** Le dernier export, envoyé à tous les admins avant la suppression. */
  dernier: boolean
}

async function connexion() {
  const { connection } = await import('../jobs/queues.ts')
  return connection
}

// Le jeton ne se garde qu'en empreinte : une lecture de Valkey ne rend aucun lien.
const cleDuJeton = (jeton: string) =>
  `export-admin:jeton:${createHash('sha256').update(jeton).digest('hex')}`
const cleDuDernierEnvoi = (organisationId: string) =>
  `export-admin:dernier-envoi:${organisationId}`

async function organisationDuSlug(prisma: PrismaClient, slug: string) {
  const organisation = await prisma.organisation.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (organisation === null) {
    throw erreurSaisie(
      i18n._('Aucune organisation ne porte le slug « {slug} ».', { slug })
    )
  }
  return organisation.id
}

/** Les admins actifs d'une organisation, ou celui qui porte l'adresse. */
async function admins(
  prisma: PrismaClient,
  organisationId: string,
  adresse?: string
): Promise<string[]> {
  const appartenances = await prisma.appartenance.findMany({
    where: {
      organisationId,
      role: 'ADMIN',
      archiveLe: null,
      ...(adresse === undefined ? {} : { user: { email: adresse } }),
    },
    select: { userId: true },
  })
  return appartenances.map(a => a.userId)
}

/**
 * Écrit l'export complet d'une organisation et tire le jeton de son lien. Avec une
 * adresse, renvoie null quand elle n'appartient pas à un admin actif, ou quand un
 * lien est parti depuis moins de 24 heures. Sans adresse, prépare le dernier export
 * pour tous les admins, sans limite ; null quand l'organisation n'a aucun admin.
 */
export async function preparerExportPourAdmin(
  prisma: PrismaClient,
  slug: string,
  courriel: string | null | undefined,
  dossier: string | undefined
): Promise<{ fichier: string; jeton: string } | null> {
  const organisationId = await organisationDuSlug(prisma, slug)
  const dernier = courriel === null || courriel === undefined
  let destinataires: string[]
  if (dernier) {
    destinataires = await admins(prisma, organisationId)
  } else {
    // La limite se lit avant l'adresse : une panne de Valkey se produit de la même
    // façon pour une adresse connue ou inconnue.
    const recent =
      (await (await connexion()).exists(cleDuDernierEnvoi(organisationId))) > 0
    const adresse = adresseDuRappel(courriel)
    destinataires =
      recent || adresse === null
        ? []
        : await admins(prisma, organisationId, adresse)
  }
  if (destinataires.length === 0) {
    journal.info(
      { evenement: 'export-admin-sans-suite', organisation: slug, dernier },
      'Aucun export pour admin n’est préparé.'
    )
    return null
  }

  const { chemin, octets } = await ecrireExport(slug, dossier)
  const jeton = randomBytes(32).toString('base64url')
  const prepare: ExportPrepare = { organisationId, destinataires, dernier }
  await (
    await connexion()
  ).set(
    cleDuJeton(jeton),
    JSON.stringify(prepare),
    'EX',
    DUREE_DU_JETON_SECONDES
  )
  const fichier = path.basename(chemin)
  journal.info(
    {
      evenement: 'export-admin-prepare',
      organisation: slug,
      fichier,
      octets,
      dernier,
    },
    'Un export pour admin a été écrit.'
  )
  return { fichier, jeton }
}

/**
 * Envoie tout de suite, sans la file du worker, le lien d'un export préparé à ses
 * destinataires. Lève une erreur quand le jeton est inconnu, ou quand le transport
 * est en panne pour un destinataire : le jeton reste alors valable pour un nouvel
 * essai.
 */
export async function envoyerLienDExport(
  prisma: PrismaClient,
  slug: string,
  jeton: string,
  transport?: Transporter | null
): Promise<void> {
  const organisationId = await organisationDuSlug(prisma, slug)
  const redis = await connexion()
  const brut = await redis.get(cleDuJeton(jeton))
  const prepare = brut === null ? null : (JSON.parse(brut) as ExportPrepare)
  if (prepare === null || prepare.organisationId !== organisationId) {
    throw erreurSaisie(i18n._('Ce jeton d’export est inconnu ou expiré.'))
  }

  // Un admin archivé depuis la préparation ne reçoit plus le lien.
  const actifs = new Set(await admins(prisma, organisationId))
  const plafond = env.COURRIEL_PLAFOND_QUOTIDIEN
  let partis = 0
  let pannes = 0
  for (const userId of prepare.destinataires.filter(id => actifs.has(id))) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    })
    const donnees = {
      sorte: 'lien-export',
      userId,
      organisationId,
      exportPourAdmin: { jeton, dernier: prepare.dernier },
    } as const
    // Le mail se compose dans la langue de l'admin (ADR 0047).
    const langue = await langueDuDestinataire(prisma, userId, organisationId)
    const message = await avecLangue(langue, () => composer(prisma, donnees))
    if (message === null) continue
    // Le lien entre dans le compteur du jour, mais part toujours (ADR 0034).
    const reserveLe = new Date()
    await reserverEnvoi('lien-export', plafond, reserveLe)
    const issue = await expedier(
      {
        destinataire: user.email,
        sujet: message.sujet,
        html: message.html,
        texte: message.texte,
        repondreA: message.repondreA,
      },
      transport
    )
    if (issue === 'panne') {
      await rendreEnvoi(plafond, reserveLe)
      pannes += 1
    } else if (issue === 'parti') {
      partis += 1
    }
  }
  if (pannes > 0) {
    throw new Error(
      `Le lien d’export n’est pas parti vers ${pannes} admin(s) : nouvel essai possible.`
    )
  }

  await redis.del(cleDuJeton(jeton))
  if (!prepare.dernier) {
    await redis.set(
      cleDuDernierEnvoi(organisationId),
      new Date().toISOString(),
      'EX',
      INTERVALLE_EXPORTS_SECONDES
    )
  }
  journal.info(
    {
      evenement: 'export-admin-envoye',
      organisation: slug,
      mails: partis,
      dernier: prepare.dernier,
    },
    'Le lien d’un export pour admin a été envoyé.'
  )
}
