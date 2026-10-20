import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { prisma } from '@relaytour/database'

import { lireGroupes } from './activites.ts'
import { erreurSaisie } from './erreurs.ts'
import { lireFormulaire } from './formulaire.ts'

// Export complet d'une organisation (ADR 0008).
//
// Le fichier appartient à l'organisation : il porte de quoi reconstituer ses
// activités, ses périodes, ses périmètres, ses fiches avec leur historique, ses
// tâches, ses membres et leurs affectations, et les demandes pour rejoindre l'équipe
// de ses périodes ouvertes. Il contient donc des noms et des adresses, y compris de
// personnes qui ne sont pas membres. Il s'écrit sur le disque du serveur (EXPORTS_DIR) et ne transite jamais
// par l'API. Le journal et les notifications n'y figurent pas : le premier se
// déduit des tâches et des fiches, les secondes sont transitoires.
//
// Les personnes sont désignées par leur adresse, les périodes par leur année et les
// autres objets par leur slug : aucun identifiant interne ne sort de la base.

export const FORMAT_EXPORT = 'relaytour-export'
export const VERSION_EXPORT = 1

const jour = (d: Date | null) =>
  d === null ? null : d.toISOString().slice(0, 10)

export async function construireExport(organisationId: string) {
  const organisation = await prisma.organisation.findUniqueOrThrow({
    where: { id: organisationId },
  })
  const [membres, activites, affectations, souhaits, droits, demandes] =
    await Promise.all([
      prisma.appartenance.findMany({
        where: { organisationId },
        select: {
          role: true,
          archiveLe: true,
          adresseVisible: true,
          user: { select: { email: true, name: true } },
        },
        orderBy: { user: { name: 'asc' } },
      }),
      prisma.activite.findMany({
        where: { organisationId },
        orderBy: [{ ordre: 'asc' }, { slug: 'asc' }],
        include: {
          editions: {
            orderBy: { annee: 'asc' },
            include: {
              effectifs: { include: { perimetre: { select: { slug: true } } } },
            },
          },
          perimetres: { orderBy: [{ ordre: 'asc' }, { slug: 'asc' }] },
          fiches: {
            orderBy: { slug: 'asc' },
            include: {
              perimetre: { select: { slug: true } },
              versions: {
                orderBy: { createdAt: 'asc' },
                include: { auteur: { select: { email: true } } },
              },
            },
          },
        },
      }),
      prisma.affectation.findMany({
        where: { perimetre: { organisationId } },
        include: {
          user: { select: { email: true } },
          perimetre: {
            select: { slug: true, activite: { select: { slug: true } } },
          },
          edition: { select: { annee: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.souhait.findMany({
        where: { perimetre: { organisationId } },
        include: {
          user: { select: { email: true } },
          perimetre: {
            select: { slug: true, activite: { select: { slug: true } } },
          },
          edition: { select: { annee: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.droitRedaction.findMany({
        where: { organisationId },
        include: {
          user: { select: { email: true } },
          perimetre: {
            select: { slug: true, activite: { select: { slug: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      // Les demandes pour rejoindre l'équipe (ADR 0015) : celles des périodes
      // ouvertes, puisque la purge supprime celles des périodes archivées.
      prisma.demande.findMany({
        where: { organisationId },
        include: {
          activite: { select: { slug: true } },
          edition: { select: { annee: true } },
          traiteePar: { select: { email: true } },
          perimetres: {
            orderBy: { createdAt: 'asc' },
            include: {
              perimetre: { select: { slug: true } },
              proposePar: { select: { email: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])

  // Les messages préparés par les admins (ADR 0020), avec leurs destinataires.
  const messages = await prisma.message.findMany({
    where: { organisationId },
    orderBy: { createdAt: 'asc' },
    include: {
      activite: { select: { slug: true } },
      edition: { select: { annee: true } },
      perimetre: { select: { slug: true } },
      auteur: { select: { email: true } },
      destinataires: {
        orderBy: { id: 'asc' },
        include: { user: { select: { email: true } } },
      },
    },
  })

  // Les dates clés de l'agenda (ADR 0037).
  const datesCles = await prisma.dateCle.findMany({
    where: { organisationId },
    orderBy: [{ editionId: 'asc' }, { jour: 'asc' }, { id: 'asc' }],
    include: {
      activite: { select: { slug: true } },
      edition: { select: { annee: true } },
      creePar: { select: { email: true } },
    },
  })

  // Les réunions de l'agenda (ADR 0037), avec leurs tâches et leurs convocations.
  const reunions = await prisma.reunion.findMany({
    where: { organisationId },
    orderBy: [{ editionId: 'asc' }, { debut: 'asc' }, { id: 'asc' }],
    include: {
      activite: { select: { slug: true } },
      edition: { select: { annee: true } },
      perimetre: { select: { slug: true } },
      creePar: { select: { email: true } },
      taches: {
        orderBy: { id: 'asc' },
        include: {
          tache: {
            select: { titre: true, perimetre: { select: { slug: true } } },
          },
        },
      },
      convocations: {
        orderBy: { id: 'asc' },
        include: { user: { select: { email: true } } },
      },
    },
  })

  // Le programme du jour J (ADR 0038) : lieux, séquences avec leurs places, et
  // fiches bénévoles.
  const [lieux, sequences, benevoles] = await Promise.all([
    prisma.lieu.findMany({
      where: { organisationId },
      orderBy: [{ activiteId: 'asc' }, { ordre: 'asc' }, { id: 'asc' }],
      include: { activite: { select: { slug: true } } },
    }),
    prisma.sequence.findMany({
      where: { organisationId },
      orderBy: [{ editionId: 'asc' }, { debut: 'asc' }, { id: 'asc' }],
      include: {
        activite: { select: { slug: true } },
        edition: { select: { annee: true } },
        perimetre: { select: { slug: true } },
        lieu: { select: { nom: true } },
        places: {
          orderBy: { id: 'asc' },
          include: {
            user: { select: { email: true } },
            benevole: { select: { nom: true } },
          },
        },
      },
    }),
    prisma.benevole.findMany({
      where: { organisationId },
      orderBy: [{ activiteId: 'asc' }, { nom: 'asc' }, { id: 'asc' }],
      include: {
        activite: { select: { slug: true } },
        creePar: { select: { email: true } },
      },
    }),
  ])

  // Les sondages de dates (ADR 0037), avec leurs créneaux et leurs réponses.
  const sondages = await prisma.sondage.findMany({
    where: { organisationId },
    orderBy: [{ editionId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    include: {
      activite: { select: { slug: true } },
      edition: { select: { annee: true } },
      perimetre: { select: { slug: true } },
      creePar: { select: { email: true } },
      participants: {
        orderBy: { id: 'asc' },
        include: { user: { select: { email: true } } },
      },
      creneaux: {
        orderBy: { ordre: 'asc' },
        include: {
          reponses: {
            orderBy: { id: 'asc' },
            include: { user: { select: { email: true } } },
          },
        },
      },
    },
  })

  const taches = await prisma.tache.findMany({
    where: { perimetre: { organisationId } },
    orderBy: [{ editionId: 'asc' }, { createdAt: 'asc' }],
    include: {
      edition: { select: { annee: true } },
      perimetre: { select: { slug: true, activiteId: true } },
      fiche: { select: { slug: true } },
      // La tâche partagée d'une déclinaison (ADR 0026), désignée par son périmètre.
      origine: {
        select: { titre: true, perimetre: { select: { slug: true } } },
      },
      creePar: { select: { email: true } },
      clotureePar: { select: { email: true } },
      realiseePar: { select: { email: true } },
      assignations: { include: { user: { select: { email: true } } } },
      // Les commentaires de la tâche (ADR 0029), du plus ancien au plus récent.
      commentaires: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { auteur: { select: { email: true } } },
      },
    },
  })

  return {
    format: FORMAT_EXPORT,
    version: VERSION_EXPORT,
    exporteLe: new Date().toISOString(),
    organisation: {
      slug: organisation.slug,
      nom: organisation.nom,
      sigle: organisation.sigle,
      fuseauHoraire: organisation.fuseauHoraire,
      statut: organisation.statut,
      declaration: organisation.configuration,
    },
    membres: membres.map(m => ({
      email: m.user.email,
      nom: m.user.name,
      role: m.role,
      // Accord pour l'organigramme (ADR 0036).
      adresseVisible: m.adresseVisible,
      archive: m.archiveLe !== null,
    })),
    activites: activites.map(a => ({
      slug: a.slug,
      nom: a.nom,
      sigle: a.sigle,
      nature: a.nature,
      souhaitsOuverts: a.souhaitsOuverts,
      formulaire: lireFormulaire(a.formulaire),
      formulaireOuvert: a.formulaireOuvert,
      adressesOrganigramme: a.adressesOrganigramme,
      groupes: lireGroupes(a.groupes),
      ordre: a.ordre,
      archive: a.archivedAt !== null,
      periodes: a.editions.map(e => ({
        annee: e.annee,
        nom: e.nom,
        debut: jour(e.debut),
        fin: jour(e.fin),
        statut: e.statut,
        effectifs: e.effectifs.map(x => ({
          perimetre: x.perimetre.slug,
          effectif: x.effectif,
        })),
      })),
      perimetres: a.perimetres.map(p => ({
        slug: p.slug,
        nom: p.nom,
        description: p.description,
        groupe: p.groupe,
        type: p.type,
        couleur: p.couleur,
        ordre: p.ordre,
        archive: p.archivedAt !== null,
      })),
      fiches: a.fiches.map(f => ({
        slug: f.slug,
        perimetre: f.perimetre?.slug ?? null,
        archive: f.archivedAt !== null,
        versions: f.versions.map(v => ({
          titre: v.titre,
          contenu: v.contenu,
          source: v.source,
          resume: v.resume,
          auteur: v.auteur?.email ?? null,
          creeLe: v.createdAt.toISOString(),
          courante: v.id === f.versionCouranteId,
        })),
      })),
      taches: taches
        .filter(t => t.perimetre.activiteId === a.id)
        .map(t => ({
          periode: t.edition.annee,
          perimetre: t.perimetre.slug,
          titre: t.titre,
          description: t.description,
          echeance: jour(t.echeance),
          statut: t.statut,
          modele: t.modeleSlug,
          fiche: t.fiche?.slug ?? null,
          origine:
            t.origine === null
              ? null
              : { perimetre: t.origine.perimetre.slug, titre: t.origine.titre },
          accord: t.accord,
          creePar: t.creePar?.email ?? null,
          clotureePar: t.clotureePar?.email ?? null,
          realiseePar: t.realiseePar?.email ?? null,
          termineeLe: t.termineeLe?.toISOString() ?? null,
          assignes: t.assignations.map(x => x.user.email),
          commentaires: t.commentaires.map(c => ({
            auteur: c.auteur?.email ?? null,
            texte: c.texte,
            creeLe: c.createdAt.toISOString(),
            modifieLe: c.modifieLe?.toISOString() ?? null,
          })),
          creeLe: t.createdAt.toISOString(),
        })),
    })),
    affectations: affectations.map(x => ({
      email: x.user.email,
      activite: x.perimetre.activite.slug,
      perimetre: x.perimetre.slug,
      periode: x.edition.annee,
      contactPrincipal: x.contactPrincipal,
    })),
    souhaits: souhaits.map(x => ({
      email: x.user.email,
      activite: x.perimetre.activite.slug,
      perimetre: x.perimetre.slug,
      periode: x.edition.annee,
    })),
    droitsRedaction: droits.map(x => ({
      email: x.user.email,
      activite: x.perimetre?.activite.slug ?? null,
      perimetre: x.perimetre?.slug ?? null,
    })),
    demandes: demandes.map(d => ({
      activite: d.activite.slug,
      periode: d.edition.annee,
      origine: d.origine,
      statut: d.statut,
      nom: d.nom,
      email: d.adresse,
      disponibilite: d.disponibilite,
      question: d.question,
      reponse: d.reponse,
      texte: d.texte,
      perimetres: d.perimetres.map(p => ({
        perimetre: p.perimetre.slug,
        proposePar: p.proposePar?.email ?? null,
        mot: p.mot,
      })),
      traiteePar: d.traiteePar?.email ?? null,
      traiteeLe: d.traiteeLe?.toISOString() ?? null,
      creeLe: d.createdAt.toISOString(),
    })),
    messages: messages.map(m => ({
      activite: m.activite?.slug ?? null,
      periode: m.edition?.annee ?? null,
      perimetre: m.perimetre?.slug ?? null,
      auteur: m.auteur?.email ?? null,
      modele: m.modele,
      objet: m.objet,
      corps: m.corps,
      champ: m.champ,
      statut: m.statut,
      statutLe: m.statutLe?.toISOString() ?? null,
      creeLe: m.createdAt.toISOString(),
      destinataires: m.destinataires.map(d => ({
        email: d.user.email,
        enCopie: d.enCopie,
      })),
    })),
    datesCles: datesCles.map(d => ({
      activite: d.activite.slug,
      periode: d.edition.annee,
      titre: d.titre,
      jour: jour(d.jour),
      jourFin: jour(d.jourFin),
      description: d.description,
      creePar: d.creePar?.email ?? null,
      creeLe: d.createdAt.toISOString(),
    })),
    lieux: lieux.map(l => ({
      activite: l.activite.slug,
      nom: l.nom,
      description: l.description,
      ordre: l.ordre,
      archive: l.archivedAt !== null,
    })),
    sequences: sequences.map(s => ({
      activite: s.activite.slug,
      periode: s.edition.annee,
      perimetre: s.perimetre?.slug ?? null,
      lieu: s.lieu?.nom ?? null,
      titre: s.titre,
      description: s.description,
      debut: s.debut.toISOString(),
      fin: s.fin.toISOString(),
      places: s.places.map(p => ({
        role: p.role,
        email: p.user?.email ?? null,
        benevole: p.benevole?.nom ?? null,
      })),
    })),
    benevoles: benevoles.map(b => ({
      activite: b.activite.slug,
      nom: b.nom,
      courriel: b.courriel,
      telephone: b.telephone,
      note: b.note,
      accordLe: b.accordLe.toISOString(),
      creePar: b.creePar?.email ?? null,
    })),
    sondages: sondages.map(s => ({
      activite: s.activite.slug,
      periode: s.edition.annee,
      perimetre: s.perimetre?.slug ?? null,
      titre: s.titre,
      description: s.description,
      statut: s.statut,
      cible: s.cible,
      creePar: s.creePar?.email ?? null,
      creeLe: s.createdAt.toISOString(),
      closLe: s.closLe?.toISOString() ?? null,
      participants: s.participants.map(p => p.user.email),
      creneaux: s.creneaux.map(c => ({
        jour: jour(c.jour),
        heureDebut: c.heureDebut,
        heureFin: c.heureFin,
        retenu: s.creneauRetenuId === c.id,
        reponses: c.reponses.map(r => ({
          email: r.user.email,
          choix: r.choix,
        })),
      })),
    })),
    reunions: reunions.map(r => ({
      activite: r.activite.slug,
      periode: r.edition.annee,
      perimetre: r.perimetre?.slug ?? null,
      titre: r.titre,
      debut: r.debut.toISOString(),
      fin: r.fin.toISOString(),
      lieu: r.lieu,
      lienVisio: r.lienVisio,
      description: r.description,
      statut: r.statut,
      cible: r.cible,
      annuleeLe: r.annuleeLe?.toISOString() ?? null,
      creePar: r.creePar?.email ?? null,
      creeLe: r.createdAt.toISOString(),
      taches: r.taches.map(t => ({
        perimetre: t.tache.perimetre.slug,
        titre: t.tache.titre,
      })),
      convocations: r.convocations.map(c => ({
        email: c.user.email,
        reponse: c.reponse,
        reponduLe: c.reponduLe?.toISOString() ?? null,
      })),
    })),
  }
}

export type ExportOrganisation = Awaited<ReturnType<typeof construireExport>>

/**
 * Écrit l'export d'une organisation dans un dossier du serveur et renvoie le chemin
 * du fichier. Le nom porte le slug et l'horodatage ; un fichier existant n'est
 * jamais remplacé.
 */
export async function ecrireExport(
  slug: string,
  dossier: string | undefined
): Promise<{ chemin: string; octets: number }> {
  if (dossier === undefined || dossier.trim() === '') {
    throw erreurSaisie(
      'Aucun dossier d’export n’est configuré sur cette installation (EXPORTS_DIR).'
    )
  }
  const organisation = await prisma.organisation.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (organisation === null) {
    throw erreurSaisie(`Aucune organisation ne porte le slug « ${slug} ».`)
  }
  const contenu = JSON.stringify(
    await construireExport(organisation.id),
    null,
    2
  )
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const suffixe = randomBytes(3).toString('hex')
  await mkdir(dossier, { recursive: true, mode: 0o750 })
  const chemin = path.join(dossier, `${slug}-${horodatage}-${suffixe}.json`)
  await writeFile(chemin, contenu + '\n', { flag: 'wx', mode: 0o640 })
  return { chemin, octets: Buffer.byteLength(contenu) + 1 }
}
