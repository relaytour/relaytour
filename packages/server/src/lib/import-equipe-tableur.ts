import { prisma } from '@relaytour/database'
import { sansAccent } from '@relaytour/commun'

import {
  ErreurEquipe,
  importerEquipe,
  type PersonneEquipe,
} from './equipe-import.ts'
import { erreurSaisie } from './erreurs.ts'
import type { LigneRapport } from './import-taches.ts'
import { i18n } from './langue.ts'
import { adresseValide } from './saisie.ts'

// Import de l'équipe depuis un tableur de l'espace organisateur (ADR 0049). Chaque
// ligne se valide ici : nom, adresse, périmètres retrouvés par leur nom ou leur
// identifiant. Les lignes valides passent ensuite par l'import d'équipe de la
// commande (ADR 0013), qui crée ce qui manque et ne retire rien. Le rapport ne
// donne que des nombres : il ne dit pas si une adresse appartient déjà à un compte
// de l'organisation (ADR 0018).

export interface LigneEquipe {
  ligne: number
  nom: string
  adresse: string
  /** Les noms ou les identifiants des périmètres, pour la période. */
  perimetres: string[]
  /** Contact principal de chacun de ses périmètres (ADR 0011). */
  contactPrincipal: boolean
}

export interface RapportImportEquipe {
  lignes: LigneRapport[]
  /** Les personnes invitées ou déjà membres, réunies. */
  personnes: number
  invitationsEnAttente: number
  affectationsCreees: number
  contactsPrincipaux: number
  rattachements: number
  mailsInvitations: number
  mailsEquipe: number
}

/** Valide les lignes, puis importe les lignes valides avec la commande d'équipe. */
export async function importerEquipeDuTableur(
  lignes: readonly LigneEquipe[],
  options: {
    organisationId: string
    activiteId: string
    annee: number
    envoyerMails: boolean
    ecrire: boolean
  }
): Promise<RapportImportEquipe> {
  const perimetres = await prisma.perimetre.findMany({
    where: { activiteId: options.activiteId, archivedAt: null },
    select: { slug: true, nom: true },
  })
  const slugDe = new Map<string, string>()
  for (const p of perimetres) {
    slugDe.set(sansAccent(p.nom), p.slug)
    slugDe.set(p.slug, p.slug)
  }

  const sorties: LigneRapport[] = []
  const personnes: PersonneEquipe[] = []
  const adresses = new Set<string>()
  const contacts = new Set<string>()
  for (const ligne of lignes) {
    const sortie: LigneRapport = {
      ligne: ligne.ligne,
      etat: options.ecrire ? 'IMPORTEE' : 'A_IMPORTER',
      raison: null,
      avertissements: [],
    }
    sorties.push(sortie)
    const ecarter = (raison: string) => {
      sortie.etat = 'ECARTEE'
      sortie.raison = raison
    }
    const nom = ligne.nom.trim()
    if (nom === '') {
      ecarter(i18n._('Le nom est vide.'))
      continue
    }
    let adresse: string
    try {
      adresse = adresseValide(ligne.adresse)
    } catch {
      const brute = ligne.adresse
      ecarter(i18n._('Adresse invalide : « {adresse} ».', { adresse: brute }))
      continue
    }
    if (adresses.has(adresse)) {
      ecarter(i18n._('Cette adresse figure déjà plus haut dans le fichier.'))
      continue
    }
    const inconnus: string[] = []
    const slugs: string[] = []
    for (const brut of ligne.perimetres) {
      const nomPerimetre = brut.trim()
      if (nomPerimetre === '') continue
      const slug = slugDe.get(sansAccent(nomPerimetre))
      if (slug === undefined) inconnus.push(nomPerimetre)
      else if (!slugs.includes(slug)) slugs.push(slug)
    }
    if (inconnus.length > 0) {
      ecarter(
        i18n._('Périmètre inconnu : « {perimetre} ».', {
          perimetre: inconnus.join(', '),
        })
      )
      continue
    }
    adresses.add(adresse)
    // Un seul contact principal par périmètre : le premier du fichier le reste.
    const contactPrincipal: string[] = []
    if (ligne.contactPrincipal) {
      for (const slug of slugs) {
        if (contacts.has(slug)) {
          sortie.avertissements.push(
            i18n._(
              'Le périmètre « {perimetre} » a déjà un contact principal plus haut dans le fichier.',
              { perimetre: slug }
            )
          )
        } else {
          contacts.add(slug)
          contactPrincipal.push(slug)
        }
      }
    }
    personnes.push({
      nom: nom.slice(0, 120),
      adresse,
      affectations: slugs,
      contactPrincipal,
      souhaits: [],
    })
  }

  const rapport: RapportImportEquipe = {
    lignes: sorties,
    personnes: 0,
    invitationsEnAttente: 0,
    affectationsCreees: 0,
    contactsPrincipaux: 0,
    rattachements: 0,
    mailsInvitations: 0,
    mailsEquipe: 0,
  }
  if (personnes.length === 0) return rapport
  try {
    const equipe = await importerEquipe(prisma, personnes, {
      organisationId: options.organisationId,
      activiteId: options.activiteId,
      annee: options.annee,
      simulation: !options.ecrire,
      envoyerMails: options.envoyerMails,
    })
    rapport.personnes =
      equipe.comptesCrees.length + equipe.comptesExistants.length
    rapport.invitationsEnAttente = equipe.invitationsEnAttente.length
    rapport.affectationsCreees = equipe.affectationsCreees.length
    rapport.contactsPrincipaux = equipe.contactsPrincipaux.length
    rapport.rattachements = equipe.rattachementsCrees.length
    rapport.mailsInvitations = equipe.mails.invitations
    rapport.mailsEquipe = equipe.mails.equipe
  } catch (erreur) {
    if (erreur instanceof ErreurEquipe) {
      throw erreurSaisie(erreur.erreurs.join(' '))
    }
    throw erreur
  }
  return rapport
}
