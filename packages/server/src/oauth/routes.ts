import { prisma } from '@relaytour/database'
import express, { type Express, type Request, type Response } from 'express'

import { mettreEnFile } from '../courriel/file.ts'
import { env } from '../env.ts'
import { adresseClient } from '../lib/adresse-client.ts'
import { echapperHtml } from '../lib/html.ts'
import { resoudreAutorisationApplication } from '../lib/jetons-acces.ts'
import { journal } from '../lib/journal.ts'
import {
  avecLangue,
  i18n,
  langueDe,
  languesDuNavigateur,
} from '../lib/langue.ts'
import { limiterParCle, rendreTentative } from '../lib/limite.ts'

import {
  adresseRetourAdmise,
  adressesRetourDe,
  enregistrerClient,
  resoudreClient,
  type RefusClient,
} from './clients.ts'
import {
  defiS256,
  defiValide,
  DUREE_DEMANDE_S,
  emettreJetons,
  empreinte,
  FORME_RENOUVELLEMENT,
  nouvelIdDemande,
  revoquerAutorisation,
  verificateurValide,
  type JetonsEmis,
} from './jetons.ts'
import {
  CHEMIN_AUTORISER,
  CHEMIN_CONSENTEMENT,
  CHEMIN_ENREGISTREMENT,
  CHEMIN_JETON,
  CHEMIN_METADONNEES_RESSOURCE,
  CHEMIN_METADONNEES_SERVEUR,
  CHEMIN_REVOCATION_OAUTH,
  adresseDeRetour,
  emetteur,
  metadonneesRessource,
  metadonneesServeur,
  ressourceValide,
} from './metadonnees.ts'
import { applicationRefusee, applicationsOuvertes } from './refus.ts'

// Serveur d'autorisation OAuth 2.1 de l'installation (ADR 0067).
//
// Les points /oauth/* et les métadonnées sont servis par l'API ; le relais de
// l'exploitant les transmet. L'écran de consentement est une page de l'espace
// organisateur : /oauth/autoriser vérifie la demande, la garde 15 minutes, puis y
// renvoie le navigateur. La réponse de la personne passe par GraphQL
// (schema/autorisations-applications.ts), qui rend l'adresse de retour.

/** Demandes d'autorisation par adresse et par quart d'heure. */
export const DEMANDES_PAR_ADRESSE = { max: 60, fenetreSecondes: 15 * 60 }
/** Échanges refusés par adresse et par quart d'heure, comme les jetons d'accès. */
export const ECHANGES_REFUSES = { max: 60, fenetreSecondes: 15 * 60 }
/** Enregistrements dynamiques par adresse et par heure. */
export const ENREGISTREMENTS_PAR_ADRESSE = { max: 10, fenetreSecondes: 3600 }

const premiere = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined

function pageErreur(
  req: Request,
  res: Response,
  statut: number,
  message: string
) {
  const langue = langueDe(
    null,
    null,
    languesDuNavigateur(req.get('accept-language'))
  )
  avecLangue(langue, () => {
    res.status(statut).type('html').send(`<!doctype html>
<html lang="${langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${i18n._('Autorisation impossible')}</title>
<style>
body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; background: #F4F5F6; color: #1A1F24; margin: 0; padding: 48px 16px; }
main { max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; padding: 28px 24px; }
h1 { font-size: 20px; margin: 0 0 16px; }
p { font-size: 15px; line-height: 24px; margin: 0; }
</style>
</head>
<body>
<main>
<h1>${i18n._('Autorisation impossible')}</h1>
<p>${echapperHtml(message)}</p>
</main>
</body>
</html>
`)
  })
}

function messageRefusClient(refus: RefusClient): string {
  if (refus === 'injoignable') {
    return i18n._('Cette installation ne peut pas vérifier l’application.')
  }
  if (refus === 'invalide') {
    return i18n._('L’application ne publie pas une description valable.')
  }
  return i18n._('Cette installation ne connaît pas cette application.')
}

/** Une réponse d'erreur des points /oauth/jeton et /oauth/enregistrement. */
function erreurOAuth(
  res: Response,
  statut: number,
  erreur: string,
  description?: string
) {
  res.status(statut).json({
    error: erreur,
    ...(description === undefined ? {} : { error_description: description }),
  })
}

const sansCache = (res: Response) =>
  res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })

const ENTETES_PAGE = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
}

/**
 * Les portées demandées : `lecture` ou `lecture ecriture`, suivies de `documents`
 * quand l'application demande la lecture du texte des documents (ADR 0072). Null
 * pour une portée inconnue.
 */
export function porteesDemandees(scope: string | undefined): string | null {
  const demandees = (scope ?? '').split(' ').filter(Boolean)
  if (
    demandees.some(
      p => p !== 'lecture' && p !== 'ecriture' && p !== 'documents'
    )
  ) {
    return null
  }
  return [
    'lecture',
    ...(demandees.includes('ecriture') ? ['ecriture'] : []),
    ...(demandees.includes('documents') ? ['documents'] : []),
  ].join(' ')
}

async function autoriser(req: Request, res: Response) {
  res.set(ENTETES_PAGE)
  const ip = adresseClient(req)
  const permis = await limiterParCle(
    `oauth-autoriser:${ip}`,
    DEMANDES_PAR_ADRESSE.max,
    DEMANDES_PAR_ADRESSE.fenetreSecondes,
    { libelle: 'la limite des demandes d’autorisation' }
  )
  if (!permis) {
    res.status(429).set('Retry-After', '60').end()
    return
  }
  const q = req.query
  const clientId = premiere(q.client_id)
  const redirectUri = premiere(q.redirect_uri)
  // Avant la vérification de l'adresse de retour, une erreur s'affiche ici :
  // le navigateur ne part jamais vers une adresse que l'application n'a pas déclarée.
  if (clientId === undefined || clientId.length === 0) {
    pageErreur(
      req,
      res,
      400,
      i18n._('La demande ne désigne aucune application.')
    )
    return
  }
  if (applicationRefusee(clientId)) {
    pageErreur(
      req,
      res,
      403,
      i18n._('Cette installation n’accepte pas cette application.')
    )
    return
  }
  const resolution = await resoudreClient(clientId)
  if (resolution.issue !== 'ok') {
    pageErreur(
      req,
      res,
      resolution.issue === 'injoignable' ? 502 : 400,
      messageRefusClient(resolution.issue)
    )
    return
  }
  const client = resolution.client
  if (
    redirectUri === undefined ||
    !adresseRetourAdmise(adressesRetourDe(client), redirectUri)
  ) {
    pageErreur(
      req,
      res,
      400,
      i18n._('L’adresse de retour ne correspond pas à celles de l’application.')
    )
    return
  }
  const state = premiere(q.state) ?? null
  const retour = (erreur: string) =>
    res.redirect(303, adresseDeRetour(redirectUri, { error: erreur, state }))
  if (state !== null && state.length > 512) {
    retour('invalid_request')
    return
  }
  if (premiere(q.response_type) !== 'code') {
    retour('unsupported_response_type')
    return
  }
  const defi = premiere(q.code_challenge)
  if (
    premiere(q.code_challenge_method) !== 'S256' ||
    defi === undefined ||
    !defiValide(defi)
  ) {
    retour('invalid_request')
    return
  }
  const portees = porteesDemandees(premiere(q.scope))
  if (portees === null) {
    retour('invalid_scope')
    return
  }
  if (!ressourceValide(premiere(q.resource))) {
    retour('invalid_target')
    return
  }
  const id = nouvelIdDemande()
  await prisma.demandeAutorisation.create({
    data: {
      id,
      clientApplicationId: client.id,
      redirectUri,
      portees,
      state,
      codeChallenge: defi,
      expireLe: new Date(Date.now() + DUREE_DEMANDE_S * 1000),
    },
  })
  res.redirect(303, `${emetteur()}${CHEMIN_CONSENTEMENT}/${id}`)
}

type Echange =
  | { issue: 'ok'; jetons: JetonsEmis }
  | { issue: 'refus'; statut: number; erreur: string; description?: string }

const refus = (
  erreur: string,
  description?: string,
  statut = 400
): Echange => ({ issue: 'refus', statut, erreur, description })

/**
 * Un rejeu révoque l'autorisation : le code ou le jeton a pu être volé. La personne
 * l'apprend par mail, une seule fois.
 */
async function rejeu(jetonAccesId: string, evenement: string) {
  if (await revoquerAutorisation(prisma, jetonAccesId)) {
    const autorisation = await prisma.jetonAcces.findUnique({
      where: { id: jetonAccesId },
      select: { userId: true, organisationId: true },
    })
    if (autorisation !== null) {
      await mettreEnFile(
        'autorisation-rejouee',
        { userId: autorisation.userId },
        { organisationId: autorisation.organisationId, jetonAccesId }
      )
    }
  }
  journal.warn(
    { evenement, jetonAccesId },
    'Un code ou un jeton de renouvellement déjà utilisé est revenu : l’autorisation est révoquée.'
  )
}

/** Les contrôles d'une autorisation au moment d'un échange. */
async function autorisationUtilisable(
  jetonAccesId: string,
  clientId: string
): Promise<Echange | null> {
  if (applicationRefusee(clientId)) return refus('invalid_grant')
  const etat = await resoudreAutorisationApplication(jetonAccesId)
  if (etat.issue === 'invalide') return refus('invalid_grant')
  if (etat.issue === 'api-fermee') {
    // Le module fermé ne consomme pas le jeton : l'autorisation répond de nouveau
    // à la réactivation.
    return refus(
      'access_denied',
      i18n._('L’API de cette organisation est fermée.'),
      403
    )
  }
  return null
}

async function echangerCode(corps: Record<string, unknown>): Promise<Echange> {
  const code = premiere(corps.code)
  const redirectUri = premiere(corps.redirect_uri)
  const clientId = premiere(corps.client_id)
  const verificateur = premiere(corps.code_verifier)
  if (
    code === undefined ||
    redirectUri === undefined ||
    clientId === undefined ||
    verificateur === undefined
  ) {
    return refus('invalid_request')
  }
  if (!ressourceValide(premiere(corps.resource))) return refus('invalid_target')
  const demande = await prisma.demandeAutorisation.findUnique({
    where: { codeEmpreinte: empreinte(code) },
    select: {
      id: true,
      redirectUri: true,
      codeChallenge: true,
      codeExpireLe: true,
      codeUtiliseLe: true,
      jetonAccesId: true,
      clientApplication: { select: { clientId: true } },
    },
  })
  if (demande === null || demande.jetonAccesId === null) {
    return refus('invalid_grant')
  }
  const jetonAccesId = demande.jetonAccesId
  if (demande.clientApplication.clientId !== clientId) {
    return refus('invalid_grant')
  }
  if (demande.codeUtiliseLe !== null) {
    await rejeu(jetonAccesId, 'code-autorisation-rejoue')
    return refus('invalid_grant')
  }
  const maintenant = new Date()
  const { count } = await prisma.demandeAutorisation.updateMany({
    where: { id: demande.id, codeUtiliseLe: null },
    data: { codeUtiliseLe: maintenant },
  })
  if (count === 0) {
    await rejeu(jetonAccesId, 'code-autorisation-rejoue')
    return refus('invalid_grant')
  }
  if (
    demande.codeExpireLe === null ||
    demande.codeExpireLe.getTime() <= maintenant.getTime() ||
    demande.redirectUri !== redirectUri ||
    !verificateurValide(verificateur) ||
    defiS256(verificateur) !== demande.codeChallenge
  ) {
    return refus('invalid_grant')
  }
  const controle = await autorisationUtilisable(jetonAccesId, clientId)
  if (controle !== null) return controle
  const autorisation = await prisma.jetonAcces.findUniqueOrThrow({
    where: { id: jetonAccesId },
    select: { id: true, portee: true, lectureDocuments: true, expireLe: true },
  })
  const jetons = await prisma.$transaction(tx =>
    emettreJetons(tx, autorisation, maintenant)
  )
  return { issue: 'ok', jetons }
}

async function renouveler(corps: Record<string, unknown>): Promise<Echange> {
  const jeton = premiere(corps.refresh_token)
  const clientId = premiere(corps.client_id)
  if (jeton === undefined || clientId === undefined) {
    return refus('invalid_request')
  }
  const resource = premiere(corps.resource)
  if (resource !== undefined && !ressourceValide(resource)) {
    return refus('invalid_target')
  }
  if (!FORME_RENOUVELLEMENT.test(jeton)) return refus('invalid_grant')
  const ligne = await prisma.jetonApplication.findUnique({
    where: { empreinte: empreinte(jeton) },
    select: {
      id: true,
      sorte: true,
      expireLe: true,
      utiliseLe: true,
      jetonAcces: {
        select: {
          id: true,
          portee: true,
          lectureDocuments: true,
          expireLe: true,
          clientApplication: { select: { clientId: true } },
        },
      },
    },
  })
  if (ligne === null || ligne.sorte !== 'RENOUVELLEMENT') {
    return refus('invalid_grant')
  }
  const autorisation = ligne.jetonAcces
  if (autorisation.clientApplication?.clientId !== clientId) {
    return refus('invalid_grant')
  }
  if (ligne.utiliseLe !== null) {
    await rejeu(autorisation.id, 'jeton-renouvellement-rejoue')
    return refus('invalid_grant')
  }
  const maintenant = new Date()
  if (ligne.expireLe.getTime() <= maintenant.getTime()) {
    return refus('invalid_grant')
  }
  const controle = await autorisationUtilisable(autorisation.id, clientId)
  if (controle !== null) return controle
  const jetons = await prisma.$transaction(async tx => {
    const { count } = await tx.jetonApplication.updateMany({
      where: { id: ligne.id, utiliseLe: null },
      data: { utiliseLe: maintenant },
    })
    if (count === 0) return null
    return emettreJetons(tx, autorisation, maintenant)
  })
  if (jetons === null) {
    await rejeu(autorisation.id, 'jeton-renouvellement-rejoue')
    return refus('invalid_grant')
  }
  return { issue: 'ok', jetons }
}

async function jeton(req: Request, res: Response) {
  sansCache(res)
  const ip = adresseClient(req)
  const cleRefus = `oauth-jeton-refuse:${ip}`
  const permis = await limiterParCle(
    cleRefus,
    ECHANGES_REFUSES.max,
    ECHANGES_REFUSES.fenetreSecondes,
    { libelle: 'la limite des échanges de jetons refusés' }
  )
  if (!permis) {
    res.set('Retry-After', '60')
    erreurOAuth(res, 429, 'slow_down')
    return
  }
  const corps = (req.body ?? {}) as Record<string, unknown>
  const type = premiere(corps.grant_type)
  const resultat =
    type === 'authorization_code'
      ? await echangerCode(corps)
      : type === 'refresh_token'
        ? await renouveler(corps)
        : refus('unsupported_grant_type')
  if (resultat.issue === 'refus') {
    erreurOAuth(res, resultat.statut, resultat.erreur, resultat.description)
    return
  }
  await rendreTentative(cleRefus)
  res.json(resultat.jetons)
}

async function revoquer(req: Request, res: Response) {
  sansCache(res)
  const ip = adresseClient(req)
  const permis = await limiterParCle(
    `oauth-revocation:${ip}`,
    ECHANGES_REFUSES.max,
    ECHANGES_REFUSES.fenetreSecondes,
    { libelle: 'la limite des révocations OAuth' }
  )
  if (!permis) {
    res.set('Retry-After', '60')
    erreurOAuth(res, 429, 'slow_down')
    return
  }
  const corps = (req.body ?? {}) as Record<string, unknown>
  const valeur = premiere(corps.token)
  if (valeur === undefined) {
    erreurOAuth(res, 400, 'invalid_request')
    return
  }
  const clientId = premiere(corps.client_id)
  const ligne = await prisma.jetonApplication.findUnique({
    where: { empreinte: empreinte(valeur) },
    select: {
      jetonAccesId: true,
      jetonAcces: {
        select: { clientApplication: { select: { clientId: true } } },
      },
    },
  })
  // RFC 7009 : un jeton inconnu reçoit la même réponse qu'un jeton révoqué.
  if (
    ligne !== null &&
    (clientId === undefined ||
      ligne.jetonAcces.clientApplication?.clientId === clientId)
  ) {
    if (await revoquerAutorisation(prisma, ligne.jetonAccesId)) {
      journal.info(
        {
          evenement: 'autorisation-application-revoquee',
          jetonAccesId: ligne.jetonAccesId,
          par: 'application',
        },
        'Une application a révoqué son autorisation.'
      )
    }
  }
  res.status(200).end()
}

async function enregistrer(req: Request, res: Response) {
  sansCache(res)
  const ip = adresseClient(req)
  const permis = await limiterParCle(
    `oauth-enregistrement:${ip}`,
    ENREGISTREMENTS_PAR_ADRESSE.max,
    ENREGISTREMENTS_PAR_ADRESSE.fenetreSecondes,
    { libelle: 'la limite des enregistrements dynamiques' }
  )
  if (!permis) {
    res.set('Retry-After', '3600')
    erreurOAuth(res, 429, 'slow_down')
    return
  }
  const corps = req.body as unknown
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    erreurOAuth(res, 400, 'invalid_client_metadata')
    return
  }
  const client = await enregistrerClient(corps as Record<string, unknown>)
  if (client === null) {
    erreurOAuth(res, 400, 'invalid_client_metadata')
    return
  }
  journal.info(
    {
      evenement: 'client-application-enregistre',
      clientApplicationId: client.id,
      ip,
    },
    'Une application s’est enregistrée elle-même.'
  )
  res.status(201).json({
    client_id: client.clientId,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    client_name: client.nom,
    redirect_uris: adressesRetourDe(client),
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  })
}

/** Une route asynchrone dont l'échec répond 503 sans détail, et se journalise. */
const asynchrone =
  (evenement: string, f: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response) => {
    f(req, res).catch((erreur: unknown) => {
      journal.error(
        { evenement, message: (erreur as Error).message },
        'Une requête OAuth n’a pas pu être traitée.'
      )
      if (!res.headersSent) res.status(503).end()
    })
  }

/** Monte les points OAuth et les métadonnées sur l'application Express. */
export function routesOAuth(app: Express) {
  // Une installation qui ferme les applications tierces ne sert rien de tout cela.
  const ouvertes: express.RequestHandler = (_req, res, suite) => {
    if (!applicationsOuvertes()) {
      res.status(404).end()
      return
    }
    suite()
  }
  const formulaire = express.urlencoded({ extended: false, limit: '16kb' })

  app.get([CHEMIN_METADONNEES_SERVEUR], ouvertes, (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').json(metadonneesServeur())
  })
  app.get(
    [CHEMIN_METADONNEES_RESSOURCE, `${CHEMIN_METADONNEES_RESSOURCE}/*chemin`],
    ouvertes,
    (_req, res) => {
      res
        .set('Cache-Control', 'public, max-age=3600')
        .json(metadonneesRessource())
    }
  )
  app.get(
    CHEMIN_AUTORISER,
    ouvertes,
    asynchrone('oauth-autoriser-en-echec', autoriser)
  )
  app.post(
    CHEMIN_JETON,
    ouvertes,
    formulaire,
    asynchrone('oauth-jeton-en-echec', jeton)
  )
  app.post(
    CHEMIN_REVOCATION_OAUTH,
    ouvertes,
    formulaire,
    asynchrone('oauth-revocation-en-echec', revoquer)
  )
  app.post(
    CHEMIN_ENREGISTREMENT,
    ouvertes,
    (_req, res, suite) => {
      if (!env.APPLICATIONS_ENREGISTREMENT_DYNAMIQUE) {
        res.status(404).end()
        return
      }
      suite()
    },
    express.json({ limit: '16kb' }),
    asynchrone('oauth-enregistrement-en-echec', enregistrer)
  )
}
