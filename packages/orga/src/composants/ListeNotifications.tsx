import { Badge, Button, Collapse, Tag, Typography } from 'antd'

import type { NotificationAfficheeFragment } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { useOrganisation } from '../lib/organisation'
import {
  grouperParActivite,
  grouperParPerimetre,
  type Groupe,
} from '../lib/rangement-notifications'
import { langueActive } from '../lib/langue'

export type Notification = NotificationAfficheeFragment

/** Le groupe à marquer comme lu : une activité, un périmètre, ou les notifications sans activité. */
export interface CibleGroupe {
  activiteId: string | null
  perimetreId: string | null
  /** Les identifiants du groupe, pour les notifications sans activité. */
  ids: string[]
}

function ilYA(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.round(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  return new Date(iso).toLocaleDateString(langueActive(), {
    day: 'numeric',
    month: 'long',
  })
}

const ROLES: Record<string, string> = {
  ADMIN_ACTIVITE: 'Admin de l’activité',
  ADMIN_ORGANISATION: 'Admin de l’organisation',
}

function Ligne({
  n,
  avecPerimetre,
  avecRole,
  onOuvrir,
}: {
  n: Notification
  avecPerimetre: boolean
  avecRole: boolean
  onOuvrir: (n: Notification) => void
}) {
  // Le périmètre, et la période quand l'activité en a plusieurs d'ouvertes,
  // s'affichent au-dessus du texte (ADR 0032).
  const contexte = [avecPerimetre ? n.perimetre?.nom : null, n.periode]
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <button
        type="button"
        className={`rt-ligne-lien${n.lue ? '' : ' rt-non-lue'}`}
        onClick={() => onOuvrir(n)}
      >
        <span style={{ minWidth: 0 }}>
          {(contexte !== '' || (avecRole && ROLES[n.niveau])) && (
            <span
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2,
              }}
            >
              {contexte !== '' && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {avecPerimetre && n.perimetre && (
                    <span
                      className="rt-point"
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        marginInlineEnd: 6,
                        background: n.perimetre.couleur ?? 'var(--rt-primaire)',
                      }}
                    />
                  )}
                  {contexte}
                </Typography.Text>
              )}
              {avecRole && ROLES[n.niveau] && (
                <Tag
                  bordered={false}
                  style={{ marginInlineEnd: 0, fontSize: 11 }}
                >
                  {ROLES[n.niveau]}
                </Tag>
              )}
            </span>
          )}
          <Typography.Text
            style={{ display: 'block', fontWeight: n.lue ? 400 : 700 }}
          >
            {n.message}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {ilYA(n.creeLe)}
          </Typography.Text>
        </span>
      </button>
    </li>
  )
}

function EnTete({
  titre,
  nonLues,
  logo,
  couleur,
  onMarquer,
}: {
  titre: string
  nonLues: number
  logo?: string | null
  couleur?: string | null
  onMarquer: () => void
}) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        minWidth: 0,
      }}
    >
      <span
        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}
      >
        {logo ? (
          <img
            src={logo}
            alt=""
            height={20}
            style={{ maxWidth: 56, objectFit: 'contain', flexShrink: 0 }}
          />
        ) : couleur !== undefined ? (
          <span
            className="rt-point"
            aria-hidden="true"
            style={{ background: couleur ?? 'var(--rt-primaire)' }}
          />
        ) : null}
        <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {titre}
        </span>
        <Badge
          count={nonLues}
          size="small"
          color="var(--rt-accent)"
          aria-label={`${nonLues} non lue${nonLues > 1 ? 's' : ''}`}
        />
      </span>
      {nonLues > 0 && (
        <Button
          size="small"
          type="text"
          onClick={e => {
            e.stopPropagation()
            onMarquer()
          }}
        >
          Tout lire
        </Button>
      )}
    </span>
  )
}

/**
 * Les notifications rangées par activité, en groupes repliables (ADR 0032). Avec
 * `parPerimetre`, chaque activité se range à son tour par périmètre (ADR 0033).
 * Un groupe sans notification non lue s'ouvre replié.
 */
export default function ListeNotifications({
  notifications,
  sansActivite,
  parPerimetre = false,
  avecRole = false,
  onOuvrir,
  onMarquer,
}: {
  notifications: Notification[]
  /** Le titre du groupe des notifications sans activité. */
  sansActivite: string
  parPerimetre?: boolean
  avecRole?: boolean
  onOuvrir: (n: Notification) => void
  onMarquer: (cible: CibleGroupe) => void
}) {
  const { activites } = useActivite()
  const organisation = useOrganisation()
  const logoDe = (activiteId: string | null) =>
    activiteId === null
      ? organisation.logoUrl
      : (activites.find(a => a.id === activiteId)?.logoUrl ??
        organisation.logoUrl)
  const cible = (g: Groupe<Notification>): CibleGroupe => ({
    activiteId: g.activiteId,
    perimetreId: g.perimetreId,
    ids: g.elements.filter(n => !n.lue).map(n => n.id),
  })
  const lignes = (elements: Notification[], avecPerimetre: boolean) => (
    <ul className="rt-liste-liens">
      {elements.map(n => (
        <Ligne
          key={n.id}
          n={n}
          avecPerimetre={avecPerimetre}
          avecRole={avecRole}
          onOuvrir={onOuvrir}
        />
      ))}
    </ul>
  )
  const groupes = grouperParActivite(notifications, sansActivite)
  return (
    <Collapse
      ghost
      className="rt-notifications"
      defaultActiveKey={groupes.filter(g => g.nonLues > 0).map(g => g.cle)}
      items={groupes.map(g => ({
        key: g.cle,
        label: (
          <EnTete
            titre={g.titre}
            nonLues={g.nonLues}
            logo={logoDe(g.activiteId)}
            onMarquer={() => onMarquer(cible(g))}
          />
        ),
        children:
          parPerimetre && g.activiteId !== null ? (
            <Collapse
              ghost
              size="small"
              defaultActiveKey={grouperParPerimetre(
                g.elements,
                'Toute l’activité'
              )
                .filter(p => p.nonLues > 0)
                .map(p => p.cle)}
              items={grouperParPerimetre(g.elements, 'Toute l’activité').map(
                p => ({
                  key: p.cle,
                  label: (
                    <EnTete
                      titre={p.titre}
                      nonLues={p.nonLues}
                      couleur={p.perimetreId === null ? undefined : p.couleur}
                      onMarquer={() =>
                        // « Toute l'activité » se marque par ses identifiants : un
                        // marquage par activité toucherait aussi ses périmètres.
                        onMarquer(
                          p.perimetreId === null
                            ? { ...cible(p), activiteId: null }
                            : cible(p)
                        )
                      }
                    />
                  ),
                  children: lignes(p.elements, false),
                })
              )}
            />
          ) : (
            lignes(g.elements, true)
          ),
      }))}
    />
  )
}
