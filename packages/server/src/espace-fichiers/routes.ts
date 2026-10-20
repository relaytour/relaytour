import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { prisma } from '@relaytour/database'
import type express from 'express'

import type { AppContext } from '../context.ts'
import { chiffrer } from '../lib/chiffrement.ts'
import { publierChangement } from '../lib/flux.ts'
import { journal } from '../lib/journal.ts'

import { cheminValide, disposition, formatApercu, typeServi } from './chemin.ts'
import { dossierLisible } from './droits.ts'
import {
  cleDeChiffrement,
  configurationMicrosoft,
  memoriserJetonAcces,
  ouvrirEspace,
  PREFIXE_ROUTES,
  reprendreConnexion,
} from './index.ts'
import { echangerCode, nomDuCompte } from './sharepoint.ts'

// Routes de l'espace de fichiers (ADR 0038), sous /medias/ que le proxy de
// l'installation relaie déjà vers l'API : le retour de la connexion chez le
// fournisseur, et l'aperçu d'un document pour la liseuse.

/** Un document relayé pèse 50 Mo au plus. Au-delà, il s'ouvre chez le fournisseur. */
export const APERCU_MAX = 50 * 1024 * 1024

type Contexte = (req: express.Request) => Promise<AppContext>

export function routesEspaceFichiers(
  app: express.Express,
  contexte: Contexte,
  origineOrga: string
): void {
  app.get(`${PREFIXE_ROUTES}/retour/sharepoint`, (req, res) => {
    void retourSharePoint(req, contexte).then(
      issue => {
        res.redirect(
          303,
          `${origineOrga}/admin/espace-fichiers?connexion=${issue}`
        )
      },
      (erreur: unknown) => {
        journal.error(
          {
            evenement: 'espace-fichiers-connexion-echouee',
            message: (erreur as Error).message,
          },
          'La connexion de l’espace de fichiers a échoué.'
        )
        res.redirect(
          303,
          `${origineOrga}/admin/espace-fichiers?connexion=echec`
        )
      }
    )
  })

  app.get(`${PREFIXE_ROUTES}/apercu`, (req, res) => {
    void apercu(req, res, contexte).catch((erreur: unknown) => {
      journal.warn(
        {
          evenement: 'espace-fichiers-apercu-echoue',
          message: (erreur as Error).message,
        },
        'Un document de l’espace de fichiers n’a pas pu être relayé.'
      )
      if (res.headersSent) res.destroy()
      else res.status(503).json({ code: 'FOURNISSEUR_INDISPONIBLE' })
    })
  })
}

/**
 * Retour de Microsoft après l'accord de l'admin. L'état à usage unique désigne la
 * personne et l'organisation : la session doit être celle de cette personne, et
 * elle doit toujours administrer cette organisation active.
 */
async function retourSharePoint(
  req: express.Request,
  contexte: Contexte
): Promise<'reussie' | 'refusee' | 'echec'> {
  const etat = typeof req.query.state === 'string' ? req.query.state : ''
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const reprise = await reprendreConnexion(etat)
  if (reprise === null) return 'echec'
  if (typeof req.query.error === 'string') return 'refusee'
  const ctx = await contexte(req)
  if (ctx.personne?.id !== reprise.userId || code === '') return 'echec'
  const admin = await prisma.appartenance.findFirst({
    where: {
      userId: reprise.userId,
      organisationId: reprise.organisationId,
      role: 'ADMIN',
      archiveLe: null,
      organisation: { statut: 'ACTIVE' },
    },
    select: { id: true },
  })
  const [configuration, cle] = await Promise.all([
    configurationMicrosoft(),
    cleDeChiffrement(),
  ])
  if (admin === null || configuration === null || cle === null) return 'echec'

  const jetons = await echangerCode(configuration, code, reprise.verificateur)
  const compte = await nomDuCompte(jetons.acces)
  const donnees = {
    fournisseur: 'SHAREPOINT' as const,
    compte,
    jeton: chiffrer(jetons.rafraichissement, cle),
    etat: 'ACTIVE' as const,
    connecteParId: reprise.userId,
  }
  const connexion = await prisma.connexionFichiers.upsert({
    where: { organisationId: reprise.organisationId },
    create: { organisationId: reprise.organisationId, ...donnees },
    update: donnees,
    select: { id: true, jeton: true },
  })
  memoriserJetonAcces(connexion.jeton, jetons.acces, jetons.expireLe)
  journal.info(
    {
      evenement: 'espace-fichiers-connecte',
      organisationId: reprise.organisationId,
      acteurId: reprise.userId,
      fournisseur: 'SHAREPOINT',
    },
    'Un espace de fichiers a été connecté.'
  )
  void publierChangement({
    entite: 'FICHIERS',
    organisationId: reprise.organisationId,
  })
  return 'reussie'
}

/**
 * Relaie un fichier d'un dossier lié vers la liseuse. La personne doit lire le
 * dossier lié ; le fichier s'adresse depuis ce dossier par un chemin de noms qui
 * n'en sort pas. Un refus et un élément absent reçoivent la même réponse.
 */
async function apercu(
  req: express.Request,
  res: express.Response,
  contexte: Contexte
): Promise<void> {
  res.set({
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-origin',
  })
  const ctx = await contexte(req)
  if (ctx.personne === null || ctx.organisation === null) {
    res.status(401).json({ code: 'UNAUTHENTICATED' })
    return
  }
  const dossierId =
    typeof req.query.dossier === 'string' ? req.query.dossier : ''
  const brut = typeof req.query.chemin === 'string' ? req.query.chemin : ''
  const chemin = brut.split('/')
  const telecharger = req.query.telecharger === '1'
  const dossier = await dossierLisible(ctx, dossierId)
  if (dossier === null || brut === '' || !cheminValide(chemin)) {
    res.status(404).json({ code: 'NOT_FOUND' })
    return
  }
  let ouvert: Awaited<ReturnType<typeof ouvrirEspace>>
  try {
    ouvert = await ouvrirEspace(ctx.organisation.id)
  } catch {
    res.status(409).json({ code: 'ESPACE_FICHIERS_INDISPONIBLE' })
    return
  }
  const { espace } = ouvert
  if (espace.fournisseur !== dossier.fournisseur) {
    res.status(409).json({ code: 'ESPACE_FICHIERS_INDISPONIBLE' })
    return
  }
  const position = {
    emplacement: dossier.emplacement,
    base: dossier.element,
    chemin,
  }
  const element = await espace.element(position)
  if (element === null || element.dossier) {
    res.status(404).json({ code: 'NOT_FOUND' })
    return
  }
  const format = telecharger
    ? 'AUCUN'
    : formatApercu(element.nom, nom => espace.convertitEnPdf(nom))
  const converti = format === 'PDF_CONVERTI'
  if (!converti && element.taille !== null && element.taille > APERCU_MAX) {
    res.status(413).json({ code: 'FICHIER_TROP_LOURD' })
    return
  }
  const contenu = await espace.ouvrir(position, { pdf: converti })
  const nom = converti ? `${element.nom}.pdf` : element.nom
  res.set({
    'Content-Type': typeServi(element.nom, format),
    'Content-Disposition': disposition(
      nom,
      format === 'AUCUN' ? 'attachment' : 'inline'
    ),
  })
  if (contenu.taille !== null) {
    if (contenu.taille > APERCU_MAX) {
      await contenu.flux.cancel()
      res.status(413).json({ code: 'FICHIER_TROP_LOURD' })
      return
    }
    res.set('Content-Length', String(contenu.taille))
  }
  let lus = 0
  const borne = new Transform({
    transform(morceau: Buffer, _encodage, suite) {
      lus += morceau.length
      if (lus > APERCU_MAX)
        suite(new Error('Document plus lourd que la limite.'))
      else suite(null, morceau)
    },
  })
  await pipeline(
    Readable.fromWeb(contenu.flux as import('node:stream/web').ReadableStream),
    borne,
    res
  )
}
