import { prisma } from '@relaytour/database'

import type { AppContext } from '../context.ts'
import { jourISO } from '../lib/agenda.ts'
import { empreinteJeton } from '../lib/abonnements-agenda.ts'
import {
  CANDIDATURES_EN_ATTENTE_MAX,
  CHOIX_MAX,
  etatAppel,
  joursDesPlages,
  fusionnerPlages,
  joursDeLaPeriode,
  MESSAGE_MAX,
  PLAGES_MAX,
  plagesValides,
  PRECISIONS_MAX,
} from '../lib/appels.ts'
import { NOM_BENEVOLE_MAX, telephoneValide } from '../lib/benevoles.ts'
import {
  jaugePublique,
  referencePublique,
  sequenceAuDepot,
  signalerCandidature,
  statutAuDepot,
} from '../lib/candidatures.ts'
import type { AdressesDeRole } from '../lib/contenu.ts'
import { erreurSaisie } from '../lib/erreurs.ts'
import {
  contientUnLien,
  descriptionPubliable,
  texteLibre,
} from '../lib/formulaire.ts'
import { publierPourActivite } from '../lib/flux.ts'
import { heureLocale } from '../lib/heures.ts'
import { jetonValide } from '../lib/jeton.ts'
import { journal } from '../lib/journal.ts'
import { jetonDe } from '../lib/liens.ts'
import { limiterParCle } from '../lib/limite.ts'
import { configurationActivite } from '../lib/organisation.ts'
import { adresseValide, texteRequis } from '../lib/saisie.ts'

import { builder } from './builder.ts'
import { PlageInput } from './repartition.ts'

// Page publique d'un appel à bénévoles (ADR 0041). Ces deux opérations se lisent
// sans session : elles ne servent que des champs publics, et vérifient elles-mêmes
// que l'appel est ouvert. Aucun type ne porte d'identifiant de la base, ni le nom
// d'une personne placée. Le dépôt n'envoie aucun mail.

// Limites d'un dépôt. Le compteur Valkey borne une adresse IP et une adresse mail ;
// la base borne l'appel entier, même si Valkey ne répond pas.
const DEPOTS_PAR_IP_ET_PAR_HEURE = 5
const DEPOTS_PAR_IP_ET_PAR_JOUR = 20
const DEPOTS_PAR_ADRESSE_ET_PAR_JOUR = 3
const DEPOTS_PAR_APPEL_ET_PAR_HEURE = 60

const FERME = 'Cet appel n’est pas ouvert.'
const TROP = 'Trop de candidatures ont été envoyées. Réessayez plus tard.'
const JETON = /^[A-Za-z0-9_-]{43}$/

interface SequencePublique {
  id: string
  ref: string
  titre: string
  debut: Date
  fin: Date
  lieu: string | null
  lieuDescription: string | null
  perimetre: string | null
  couleur: string | null
  consignes: string | null
  besoin: number
  renforts: number
}

interface AppelOuvert {
  appelId: string
  empreinte: string
  organisationId: string
  activiteId: string
  editionId: string
  perimetreId: string | null
  portee: string
  /** La séquence d'un appel de portée « séquence ». */
  sequenceCible: string | null
  organisation: string
  activite: string
  periode: string
  introduction: string | null
  contact: string
  ouAilleurs: boolean
  fuseau: string
  sequences: SequencePublique[]
  /** Les jours où une plage peut tomber, au format AAAA-MM-JJ. */
  jours: string[]
}

/**
 * L'appel désigné par un jeton, s'il est ouvert : l'organisation est active,
 * l'activité n'est pas archivée, la période non plus, l'appel suit ses dates et un
 * contact est déclaré. Sinon null, sans dire pourquoi.
 */
async function appelOuvert(
  jeton: string,
  maintenant = new Date()
): Promise<AppelOuvert | null> {
  if (!JETON.test(jeton)) return null
  const appel = await prisma.appelBenevoles.findFirst({
    where: {
      empreinte: empreinteJeton(jeton),
      organisation: { statut: 'ACTIVE' },
      activite: { archivedAt: null },
      edition: { statut: { not: 'ARCHIVEE' } },
    },
    include: {
      activite: { select: { nom: true } },
      edition: { select: { nom: true } },
      organisation: { select: { fuseauHoraire: true } },
    },
  })
  // Le jeton doit dériver du secret courant : après un changement de secret,
  // l'ancienne adresse cesse de répondre, même si l'empreinte gardée lui
  // correspond.
  if (
    appel === null ||
    etatAppel(appel, maintenant) !== 'OUVERT' ||
    !jetonValide(jeton, await jetonDe('appel', appel.sel))
  ) {
    return null
  }
  const configuration = await configurationActivite(appel.activiteId)
  if (configuration.contactRecrutement === undefined) return null
  const role: AdressesDeRole = {
    domaines: configuration.domainesCourrielAutorises,
    adresses: configuration.adressesRoleAutorisees,
  }
  const fuseau = appel.organisation.fuseauHoraire
  const [sequences, toutes] = await Promise.all([
    prisma.sequence.findMany({
      where: {
        editionId: appel.editionId,
        besoinBenevoles: { gt: 0 },
        // Une séquence commencée ne reçoit plus de candidature.
        debut: { gt: maintenant },
        ...(appel.portee === 'PERIMETRE'
          ? { perimetreId: appel.perimetreId }
          : appel.portee === 'SEQUENCE'
            ? { id: appel.sequenceId ?? '' }
            : {}),
      },
      include: {
        lieu: { select: { nom: true, description: true, ordre: true } },
        perimetre: { select: { nom: true, couleur: true } },
        _count: { select: { places: { where: { role: 'RENFORT' } } } },
      },
      orderBy: [{ debut: 'asc' }, { id: 'asc' }],
    }),
    prisma.sequence.findMany({
      where: { editionId: appel.editionId },
      select: { debut: true, fin: true },
    }),
  ])
  const jours = joursDesPlages(
    await joursDeLaPeriode(prisma, appel.editionId),
    toutes,
    fuseau
  )
  return {
    appelId: appel.id,
    empreinte: appel.empreinte,
    organisationId: appel.organisationId,
    activiteId: appel.activiteId,
    editionId: appel.editionId,
    perimetreId: appel.perimetreId,
    portee: appel.portee,
    sequenceCible: appel.sequenceId,
    organisation: configuration.nomCourt,
    activite: appel.activite.nom,
    periode: appel.edition.nom,
    introduction: appel.introduction,
    contact: configuration.contactRecrutement,
    ouAilleurs: appel.portee === 'PERIODE',
    fuseau,
    jours,
    sequences: sequences.map(s => ({
      id: s.id,
      ref: referencePublique(appel.empreinte, s.id),
      titre: s.titre,
      debut: s.debut,
      fin: s.fin,
      lieu: s.lieu?.nom ?? null,
      lieuDescription: descriptionPubliable(s.lieu?.description ?? null, role),
      perimetre: s.perimetre?.nom ?? null,
      couleur: s.perimetre?.couleur ?? null,
      consignes: descriptionPubliable(s.consignesBenevoles, role),
      besoin: s.besoinBenevoles ?? 0,
      renforts: s._count.places,
    })),
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

const SequencePubliqueRef = builder
  .objectRef<SequencePublique & { fuseau: string }>('SequencePublique')
  .implement({
    description:
      'Une séquence qui cherche des bénévoles, telle que la page publique la montre.',
    fields: t => ({
      ref: t.exposeString('ref', {
        description: 'La référence de la séquence dans cet appel.',
      }),
      titre: t.exposeString('titre'),
      jour: t.string({ resolve: s => heureLocale(s.debut, s.fuseau).jour }),
      jourFin: t.string({ resolve: s => heureLocale(s.fin, s.fuseau).jour }),
      heureDebut: t.string({
        resolve: s => heureLocale(s.debut, s.fuseau).heure,
      }),
      heureFin: t.string({ resolve: s => heureLocale(s.fin, s.fuseau).heure }),
      lieu: t.exposeString('lieu', { nullable: true }),
      lieuDescription: t.exposeString('lieuDescription', {
        nullable: true,
        description:
          'Vaut null sans description, ou si elle contient une coordonnée personnelle.',
      }),
      perimetre: t.exposeString('perimetre', { nullable: true }),
      couleur: t.exposeString('couleur', { nullable: true }),
      consignes: t.exposeString('consignes', {
        nullable: true,
        description:
          'Vaut null sans consignes, ou si elles contiennent une coordonnée personnelle.',
      }),
      placesRecherchees: t.int({
        resolve: s => jaugePublique(s.besoin, s.renforts).placesRecherchees,
      }),
      complete: t.boolean({
        description:
          'Vrai quand le besoin est atteint : une candidature passe en liste d’attente.',
        resolve: s => jaugePublique(s.besoin, s.renforts).complete,
      }),
    }),
  })

const AppelPublicRef = builder
  .objectRef<AppelOuvert>('AppelBenevolesPublic')
  .implement({
    description:
      'La page publique d’un appel à bénévoles (ADR 0041). Lisible sans session.',
    fields: t => ({
      organisation: t.exposeString('organisation'),
      activite: t.exposeString('activite'),
      periode: t.exposeString('periode'),
      introduction: t.exposeString('introduction', { nullable: true }),
      contact: t.exposeString('contact', {
        description:
          'Adresse de rôle à laquelle demander l’accès à ses données ou leur suppression.',
      }),
      ouAilleurs: t.exposeBoolean('ouAilleurs', {
        description:
          'Vrai : la personne peut proposer son aide là où il manque du monde, sans choisir de séquence.',
      }),
      jours: t.exposeStringList('jours', {
        description: 'Les jours où une plage de disponibilité peut tomber.',
      }),
      sequences: t.field({
        type: [SequencePubliqueRef],
        resolve: a => a.sequences.map(s => ({ ...s, fuseau: a.fuseau })),
      }),
    }),
  })

// ── Lecture ──────────────────────────────────────────────────────────────────

builder.queryField('appelBenevolesPublic', t =>
  t.field({
    type: AppelPublicRef,
    nullable: true,
    description:
      'La page publique d’un appel, ou null s’il est fermé ou inconnu. Lisible sans session.',
    args: { jeton: t.arg.string({ required: true }) },
    resolve: (_root, args) => appelOuvert(args.jeton),
  })
)

// ── Dépôt ────────────────────────────────────────────────────────────────────

/** Refuse le dépôt quand l'adresse IP ou l'adresse mail en envoient trop. */
async function exigerDebitRaisonnable(
  ctx: AppContext,
  appel: AppelOuvert,
  email: string
) {
  const refuser = { siIndisponible: 'refuser' } as const
  const ip = ctx.ip ?? 'inconnue'
  const parIp =
    (await limiterParCle(
      `benevoles-ip-${ip}`,
      DEPOTS_PAR_IP_ET_PAR_HEURE,
      3600,
      refuser
    )) &&
    (await limiterParCle(
      `benevoles-ip-jour-${ip}`,
      DEPOTS_PAR_IP_ET_PAR_JOUR,
      86_400,
      refuser
    ))
  const parAdresse = await limiterParCle(
    `benevoles-adresse-${appel.appelId}-${email}`,
    DEPOTS_PAR_ADRESSE_ET_PAR_JOUR,
    86_400,
    refuser
  )
  if (!parIp || !parAdresse) throw erreurSaisie(TROP)
}

builder.mutationField('deposerCandidature', t =>
  t.boolean({
    description:
      'Dépose une candidature sur un appel ouvert. La réponse est la même que l’adresse ait déjà une candidature, une fiche ou un compte. Aucun mail ne part. Utilisable sans session.',
    args: {
      jeton: t.arg.string({ required: true }),
      nom: t.arg.string({ required: true }),
      email: t.arg.string({ required: true }),
      telephone: t.arg.string(),
      sequences: t.arg.stringList({
        required: true,
        description: 'Les références des séquences choisies.',
      }),
      ouAilleurs: t.arg.boolean({ defaultValue: false }),
      plages: t.arg({ type: [PlageInput] }),
      precisions: t.arg.string(),
      message: t.arg.string(),
      accord: t.arg.boolean({
        required: true,
        description:
          'Vrai : la personne accepte l’enregistrement de ses données.',
      }),
      // Champ piège : un robot le remplit, une personne ne le voit pas.
      siteWeb: t.arg.string(),
    },
    resolve: async (_root, args, ctx) => {
      const maintenant = new Date()
      const appel = await appelOuvert(args.jeton, maintenant)
      if (appel === null) throw erreurSaisie(FERME)
      // Un dépôt piégé reçoit la même réponse qu'un dépôt accepté, sans écriture.
      if ((args.siteWeb ?? '').trim() !== '') return true

      if (!args.accord) {
        throw erreurSaisie(
          'Une candidature ne s’enregistre qu’avec votre accord.'
        )
      }
      const email = adresseValide(args.email)
      const nom = texteRequis(args.nom, 'Le nom', NOM_BENEVOLE_MAX)
      if (contientUnLien(nom)) {
        throw erreurSaisie('Les liens ne sont pas acceptés dans ce formulaire.')
      }
      const telephone = telephoneValide(args.telephone)
      const precisions = texteLibre(
        args.precisions,
        'Les précisions',
        PRECISIONS_MAX
      )
      const message = texteLibre(args.message, 'Le message', MESSAGE_MAX)
      const ouAilleurs = appel.ouAilleurs && (args.ouAilleurs ?? false)
      const refs = [...new Set(args.sequences)]
      if (refs.length > CHOIX_MAX) {
        throw erreurSaisie(
          `Une candidature choisit ${CHOIX_MAX} séquences au plus.`
        )
      }
      const parRef = new Map(appel.sequences.map(s => [s.ref, s.id]))
      const sequenceIds = refs.map(ref => parRef.get(ref))
      if (sequenceIds.some(id => id === undefined)) {
        throw erreurSaisie('Une séquence choisie n’est plus proposée.')
      }
      if (sequenceIds.length === 0 && !ouAilleurs) {
        throw erreurSaisie('Choisissez au moins une séquence.')
      }
      const plages = plagesValides(
        (args.plages ?? []).map(p => ({
          jour: jourISO(p.jour),
          jourFin: p.jourFin ? jourISO(p.jourFin) : null,
          heureDebut: p.heureDebut,
          heureFin: p.heureFin,
        })),
        appel.jours,
        appel.fuseau
      )

      await exigerDebitRaisonnable(ctx, appel, email)

      const nouvelles = await prisma.$transaction(async tx => {
        // Ordre des verrous : l'appel, la candidature, puis les séquences dans
        // l'ordre de leurs identifiants. Les décisions de l'équipe prennent la
        // candidature puis la séquence : aucun cycle. Tous les verrous se
        // prennent avant la première lecture ordinaire : sous MariaDB 11.8, une
        // lecture verrouillante d'une ligne modifiée depuis la vue de la
        // transaction échoue (erreur 1020) au lieu de lire la ligne à jour.
        const [courant] = await tx.$queryRaw<
          {
            portee: string
            sequenceId: string | null
            ouvertLe: Date
            fermeLe: Date
            fermeManuellementLe: Date | null
            empreinte: string
          }[]
        >`SELECT portee, sequenceId, ouvertLe, fermeLe, fermeManuellementLe, empreinte
          FROM AppelBenevoles WHERE id = ${appel.appelId} FOR UPDATE`
        // L'appel se relit sous son verrou : une fermeture ou une nouvelle
        // adresse validée entre-temps refuse le dépôt.
        if (
          courant === undefined ||
          courant.empreinte !== empreinteJeton(args.jeton) ||
          etatAppel(courant, new Date()) !== 'OUVERT'
        ) {
          throw erreurSaisie(FERME)
        }
        // La candidature en attente de l'adresse, verrouillée : une décision
        // validée entre-temps l'a clôturée et libérée.
        const trouvee = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM Candidature
          WHERE appelId = ${appel.appelId} AND courrielEnAttente = ${email}
          FOR UPDATE`
        // Toutes les séquences demandées se revalident sous leur verrou, déjà
        // choisies ou non : la réponse ne dépend pas de la candidature existante.
        const maintenantSousVerrou = new Date()
        const etats = new Map<string, { besoin: number; renforts: number }>()
        for (const sequenceId of [...(sequenceIds as string[])].sort()) {
          const sequence = await sequenceAuDepot(tx, sequenceId)
          if (
            sequence === null ||
            sequence.editionId !== appel.editionId ||
            sequence.besoin <= 0 ||
            sequence.debut.getTime() <= maintenantSousVerrou.getTime() ||
            (appel.portee === 'PERIMETRE' &&
              sequence.perimetreId !== appel.perimetreId) ||
            (appel.portee === 'SEQUENCE' && sequenceId !== appel.sequenceCible)
          ) {
            throw erreurSaisie('Une séquence choisie n’est plus proposée.')
          }
          etats.set(sequenceId, sequence)
        }
        // Les plafonds valent pour tout dépôt, que l'adresse ait déjà une
        // candidature ou non : la réponse ne trahit rien. Une candidature
        // complétée compte par sa date de mise à jour.
        const [recentes, enAttente] = await Promise.all([
          tx.candidature.count({
            where: {
              appelId: appel.appelId,
              updatedAt: { gte: new Date(maintenant.getTime() - 3600_000) },
            },
          }),
          tx.candidature.count({
            where: { appelId: appel.appelId, statut: 'EN_ATTENTE' },
          }),
        ])
        if (
          recentes >= DEPOTS_PAR_APPEL_ET_PAR_HEURE ||
          enAttente >= CANDIDATURES_EN_ATTENTE_MAX
        ) {
          throw erreurSaisie(TROP)
        }
        const existante =
          trouvee[0] === undefined
            ? null
            : await tx.candidature.findUniqueOrThrow({
                where: { id: trouvee[0].id },
                include: {
                  choix: { select: { sequenceId: true } },
                  plages: true,
                },
              })
        const dejaChoisies = new Set(
          existante?.choix.map(c => c.sequenceId) ?? []
        )
        // Au-delà de CHOIX_MAX, les séquences en trop sont ignorées sans
        // erreur : un refus trahirait les choix d'une candidature existante.
        const ajoutees = (sequenceIds as string[])
          .filter(id => !dejaChoisies.has(id))
          .sort()
          .slice(0, Math.max(0, CHOIX_MAX - dejaChoisies.size))
        const choix = ajoutees.map(sequenceId => ({
          sequenceId,
          statut: statutAuDepot(etats.get(sequenceId)!),
        }))
        if (existante === null) {
          await tx.candidature.create({
            data: {
              organisationId: appel.organisationId,
              activiteId: appel.activiteId,
              editionId: appel.editionId,
              appelId: appel.appelId,
              nom,
              courriel: email,
              courrielEnAttente: email,
              telephone,
              message,
              precisionsDisponibilite: precisions,
              ouAilleurs,
              accordLe: maintenant,
              choix: { create: choix },
              plages: {
                create: plages.map(p => ({ editionId: appel.editionId, ...p })),
              },
            },
          })
          return ajoutees
        }
        // Un second dépôt complète la première candidature, sans changer le nom
        // ni l'adresse.
        const reunies = fusionnerPlages([...existante.plages, ...plages]).slice(
          0,
          PLAGES_MAX
        )
        await tx.candidature.update({
          where: { id: existante.id },
          data: {
            telephone: existante.telephone ?? telephone,
            message: message ?? existante.message,
            precisionsDisponibilite:
              precisions ?? existante.precisionsDisponibilite,
            ouAilleurs: existante.ouAilleurs || ouAilleurs,
            choix: { create: choix },
          },
        })
        await tx.plageDisponibilite.deleteMany({
          where: { candidatureId: existante.id },
        })
        await tx.plageDisponibilite.createMany({
          data: reunies.map(p => ({
            editionId: appel.editionId,
            candidatureId: existante.id,
            debut: p.debut,
            fin: p.fin,
          })),
        })
        // Une candidature déjà rattachée à une fiche y verse aussi ses
        // nouvelles plages : la répartition lit les plages de la fiche.
        if (existante.benevoleId !== null && plages.length > 0) {
          const deLaFiche = await tx.plageDisponibilite.findMany({
            where: {
              benevoleId: existante.benevoleId,
              editionId: appel.editionId,
            },
          })
          const fusion = fusionnerPlages([...deLaFiche, ...plages]).slice(
            0,
            PLAGES_MAX
          )
          await tx.plageDisponibilite.deleteMany({
            where: {
              benevoleId: existante.benevoleId,
              editionId: appel.editionId,
            },
          })
          await tx.plageDisponibilite.createMany({
            data: fusion.map(p => ({
              editionId: appel.editionId,
              benevoleId: existante.benevoleId,
              debut: p.debut,
              fin: p.fin,
            })),
          })
        }
        return ajoutees
      })

      journal.info(
        {
          evenement: 'candidature-deposee',
          activiteId: appel.activiteId,
          sequences: nouvelles.length,
        },
        'Une candidature a été déposée sur un appel à bénévoles.'
      )
      const perimetreIds = await prisma.sequence.findMany({
        where: { id: { in: nouvelles }, perimetreId: { not: null } },
        select: { perimetreId: true },
      })
      await signalerCandidature(prisma, {
        organisationId: appel.organisationId,
        activiteId: appel.activiteId,
        editionId: appel.editionId,
        perimetreIds: [
          ...new Set([
            ...perimetreIds.map(p => p.perimetreId!),
            ...(appel.perimetreId ? [appel.perimetreId] : []),
          ]),
        ],
      })
      publierPourActivite(
        'CANDIDATURE',
        appel.organisationId,
        appel.activiteId,
        {
          editionId: appel.editionId,
        }
      )
      return true
    },
  })
)
