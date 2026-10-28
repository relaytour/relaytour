import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { prisma } from '@relaytour/database'
import type express from 'express'

import type { AppContext } from '../context.ts'
import { publierChangement } from '../lib/flux.ts'
import { journal } from '../lib/journal.ts'

import { planifierVerificationAcces } from './acces.ts'
import { cheminValide, disposition, formatApercu, typeServi } from './chemin.ts'
import { dossierLisiblePour } from './droits.ts'
import { cheminDeLExportSous, dansLExport } from './isolement.ts'
import { echangerCodeDropbox, nomDuCompteDropbox } from './dropbox.ts'
import { echangerCodeGoogle, nomDuCompteGoogle, type Jetons } from './google.ts'
import {
  configurationDropbox,
  configurationGoogle,
  configurationMicrosoft,
  documentNatif,
  enregistrerConnexion,
  memoriserJetonAcces,
  ouvrirEspace,
  PREFIXE_ROUTES,
  reprendreConnexion,
} from './index.ts'
import { echangerCode, nomDuCompte } from './sharepoint.ts'
import type { Fournisseur, Portee } from './types.ts'

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
  app.get(`${PREFIXE_ROUTES}/retour/:fournisseur`, (req, res) => {
    const connecteur = CONNECTEURS[req.params.fournisseur]
    if (connecteur === undefined) {
      res.status(404).end()
      return
    }
    void retourOAuth(req, contexte, connecteur).then(
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
interface ConnecteurOAuth {
  fournisseur: Fournisseur
  /**
   * Échange le code contre des jetons, ou null si le fournisseur est fermé. Un
   * fournisseur qui dit ce qu'il a accordé rend aussi la portée accordée.
   */
  echanger: (
    code: string,
    verificateur: string,
    portee: Portee
  ) => Promise<(Jetons & { portee?: Portee }) | null>
  nomDuCompte: (acces: string) => Promise<string>
}

/** Les fournisseurs à connexion OAuth, par le segment de leur adresse de retour. */
const CONNECTEURS: Record<string, ConnecteurOAuth> = {
  sharepoint: {
    fournisseur: 'SHAREPOINT',
    echanger: async (code, verificateur, portee) => {
      const c = await configurationMicrosoft()
      return c === null ? null : echangerCode(c, code, verificateur, portee)
    },
    nomDuCompte,
  },
  google: {
    fournisseur: 'GOOGLE_DRIVE',
    echanger: async (code, verificateur) => {
      const c = await configurationGoogle()
      return c === null ? null : echangerCodeGoogle(c, code, verificateur)
    },
    nomDuCompte: nomDuCompteGoogle,
  },
  dropbox: {
    fournisseur: 'DROPBOX',
    echanger: async (code, verificateur) => {
      const c = await configurationDropbox()
      return c === null ? null : echangerCodeDropbox(c, code, verificateur)
    },
    nomDuCompte: nomDuCompteDropbox,
  },
}

/**
 * Retour du fournisseur après l'accord de l'admin. L'état à usage unique désigne
 * la personne, l'organisation et le fournisseur : la session doit être celle de
 * cette personne, et elle doit toujours administrer cette organisation active.
 */
async function retourOAuth(
  req: express.Request,
  contexte: Contexte,
  connecteur: ConnecteurOAuth
): Promise<IssueRetour> {
  const etat = typeof req.query.state === 'string' ? req.query.state : ''
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const reprise = await reprendreConnexion(etat)
  if (reprise === null || reprise.fournisseur !== connecteur.fournisseur)
    return 'echec'
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
  if (admin === null) return 'echec'

  const demandee = reprise.portee ?? 'FICHIERS'
  const jetons = await connecteur.echanger(code, reprise.verificateur, demandee)
  if (jetons === null) return 'echec'
  // Un compte qui n'obtient pas toutes les autorisations demandées garde ce qui
  // lui est accordé : la connexion ne promet pas une vérification impossible.
  const portee = jetons.portee ?? demandee
  const connexion = await enregistrerConnexion({
    organisationId: reprise.organisationId,
    fournisseur: connecteur.fournisseur,
    methode: 'COMPTE',
    compte: await connecteur.nomDuCompte(jetons.acces),
    secret: jetons.rafraichissement,
    connecteParId: reprise.userId,
    portee,
  })
  memoriserJetonAcces(connexion.jeton, jetons.acces, jetons.expireLe)
  journal.info(
    {
      evenement: 'espace-fichiers-connecte',
      organisationId: reprise.organisationId,
      acteurId: reprise.userId,
      fournisseur: connecteur.fournisseur,
      portee,
      porteeDemandee: demandee,
    },
    'Un espace de fichiers a été connecté.'
  )
  void publierChangement({
    entite: 'FICHIERS',
    organisationId: reprise.organisationId,
  })
  // La vérification des accès reprend avec le compte qui vient de se connecter.
  planifierVerificationAcces(reprise.organisationId)
  return issueAccordee(demandee, portee)
}

export type IssueRetour =
  'reussie' | 'sans-annuaire' | 'sans-gestion' | 'refusee' | 'echec'

/**
 * L'issue d'une connexion réussie, d'après la portée accordée : l'écran dit
 * quelle autorisation manque quand le fournisseur en accorde moins.
 */
export function issueAccordee(demandee: Portee, accordee: Portee): IssueRetour {
  if (accordee === demandee) return 'reussie'
  return accordee === 'FICHIERS' ? 'sans-annuaire' : 'sans-gestion'
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
  // Un document lié ouvert aux lecteurs de sa fiche se lit par son identifiant,
  // sans ouvrir le reste du dossier (ADR 0043).
  const ressourceId =
    typeof req.query.ressource === 'string' ? req.query.ressource : null
  const dossier = await dossierLisiblePour(ctx, dossierId, chemin, ressourceId)
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
  // Le dossier d'export, s'il se trouve sous ce dossier lié, ne se lit pas.
  if (
    dansLExport(
      chemin,
      await cheminDeLExportSous(espace, dossier.organisationId, dossier)
    )
  ) {
    res.status(404).json({ code: 'NOT_FOUND' })
    return
  }
  const element = await espace.element(position)
  if (element === null || element.dossier) {
    res.status(404).json({ code: 'NOT_FOUND' })
    return
  }
  const format = telecharger
    ? 'AUCUN'
    : formatApercu(
        element.nom,
        nom => espace.convertitEnPdf(nom, element.typeMime),
        documentNatif(espace.fournisseur, element.typeMime)
      )
  const converti = format === 'PDF_CONVERTI'
  if (!converti && element.taille !== null && element.taille > APERCU_MAX) {
    res.status(413).json({ code: 'FICHIER_TROP_LOURD' })
    return
  }
  const contenu = await espace.ouvrir(position, { pdf: converti })
  const nom = converti ? `${element.nom}.pdf` : (contenu.nom ?? element.nom)
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
