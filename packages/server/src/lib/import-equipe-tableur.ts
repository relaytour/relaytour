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
    edition: { id: string; annee: number }
    /** Seul l'admin de l'organisation apprend qu'une adresse est archivée (ADR 0031). */
    adminOrganisation: boolean
    envoyerMails: boolean
    ecrire: boolean
  }
): Promise<RapportImportEquipe> {
  const { organisationId, activiteId, edition } = options
  const perimetres = await prisma.perimetre.findMany({
    where: { activiteId, archivedAt: null },
    select: { slug: true, nom: true },
  })
  const slugDe = new Map<string, string>()
  const nomDe = new Map<string, string>()
  for (const p of perimetres) {
    slugDe.set(sansAccent(p.nom), p.slug)
    slugDe.set(p.slug, p.slug)
    nomDe.set(p.slug, p.nom)
  }

  // Première passe : ce que la ligne dit d'elle-même.
  interface Candidat {
    sortie: LigneRapport
    nom: string
    adresse: string
    slugs: string[]
    contact: boolean
  }
  const sorties: LigneRapport[] = []
  const candidats: Candidat[] = []
  const adresses = new Set<string>()
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
    candidats.push({
      sortie,
      nom: nom.slice(0, 120),
      adresse,
      slugs,
      contact: ligne.contactPrincipal,
    })
  }

  // Seconde passe : ce que la base sait déjà des adresses du fichier, et les
  // contacts principaux de la période.
  const comptes = await prisma.user.findMany({
    where: { email: { in: [...adresses] } },
    select: { id: true, email: true },
  })
  const idDe = new Map(comptes.map(c => [c.email.toLowerCase(), c.id]))
  const ids = comptes.map(c => c.id)
  const [appartenances, rattachements, affectations, contactsEnBase] =
    await Promise.all([
      prisma.appartenance.findMany({
        where: { organisationId, userId: { in: ids } },
        select: { userId: true, archiveLe: true },
      }),
      prisma.rattachementActivite.findMany({
        where: { activiteId, userId: { in: ids } },
        select: { userId: true },
      }),
      prisma.affectation.findMany({
        where: { editionId: edition.id, userId: { in: ids } },
        select: { userId: true, perimetre: { select: { slug: true } } },
      }),
      prisma.affectation.findMany({
        where: { editionId: edition.id, contactPrincipal: true },
        select: { userId: true, perimetre: { select: { slug: true } } },
      }),
    ])
  const appartenanceDe = new Map(appartenances.map(a => [a.userId, a]))
  const rattaches = new Set(rattachements.map(r => r.userId))
  const affecte = new Set(
    affectations.map(a => `${a.userId}|${a.perimetre.slug}`)
  )
  const contactDe = new Map(
    contactsEnBase.map(c => [c.perimetre.slug, c.userId])
  )

  const personnes: PersonneEquipe[] = []
  const contactsDuFichier = new Set<string>()
  for (const candidat of candidats) {
    const { sortie, slugs } = candidat
    const userId = idDe.get(candidat.adresse)
    const appartenance =
      userId === undefined ? undefined : appartenanceDe.get(userId)
    if (appartenance?.archiveLe != null) {
      sortie.etat = 'ECARTEE'
      sortie.raison = options.adminOrganisation
        ? i18n._(
            'Cette personne est archivée dans votre organisation : rétablissez-la depuis l’annuaire.'
          )
        : i18n._('Cette adresse ne peut pas être importée.')
      continue
    }
    // Un seul contact principal par périmètre : celui de la base le reste, puis le
    // premier du fichier.
    const contactPrincipal: string[] = []
    if (candidat.contact) {
      for (const slug of slugs) {
        const nom = nomDe.get(slug) ?? slug
        const enBase = contactDe.get(slug)
        if (enBase !== undefined && enBase !== userId) {
          sortie.avertissements.push(
            i18n._(
              'Le périmètre « {perimetre} » a déjà un contact principal : il le reste.',
              { perimetre: nom }
            )
          )
        } else if (contactsDuFichier.has(slug)) {
          sortie.avertissements.push(
            i18n._(
              'Le périmètre « {perimetre} » a déjà un contact principal plus haut dans le fichier.',
              { perimetre: nom }
            )
          )
        } else {
          contactsDuFichier.add(slug)
          contactPrincipal.push(slug)
        }
      }
    }
    // Une personne déjà dans l'équipe, avec ces affectations et ce rôle de contact,
    // n'a rien à recevoir : la ligne est déjà importée.
    const deja =
      userId !== undefined &&
      appartenance !== undefined &&
      rattaches.has(userId) &&
      slugs.every(slug => affecte.has(`${userId}|${slug}`)) &&
      contactPrincipal.every(slug => contactDe.get(slug) === userId)
    if (deja) {
      sortie.etat = 'DEJA_IMPORTEE'
      continue
    }
    personnes.push({
      nom: candidat.nom,
      adresse: candidat.adresse,
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
      organisationId,
      activiteId,
      annee: edition.annee,
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
