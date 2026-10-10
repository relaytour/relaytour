import {
  CheckOutlined,
  CustomerServiceOutlined,
  DownloadOutlined,
  LogoutOutlined,
  MailOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  TagOutlined,
} from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Badge, Dropdown } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useActivite } from '../lib/activite'
import { estInstallee } from '../lib/installation'
import { useMesInvitations } from '../lib/invitations'
import { VERSION } from '../lib/notes-de-version'
import { useOrganisation } from '../lib/organisation'
import {
  useChangerOrganisation,
  useDeconnexion,
  useSession,
} from '../lib/session'

import { lienSupport, ouvreUnOnglet } from '../lib/support'

import InstallerApplication from './InstallerApplication'
import MesInvitations from './MesInvitations'
import NotesDeVersion from './NotesDeVersion'
import { Avatar } from './Personne'

/**
 * Le compte de la barre haute : initiales, nom, préférences, modes d'emploi,
 * installation de l'application (ADR 0023), support et notes de version (ADR 0021), changement d'organisation quand la
 * personne en a plusieurs (ADR 0008), et déconnexion.
 */
export default function MenuCompte({
  nom,
  afficherNom,
}: {
  nom: string
  afficherNom: boolean
}) {
  const navigate = useNavigate()
  const deconnecter = useDeconnexion()
  const { organisations } = useSession()
  const changerOrganisation = useChangerOrganisation()
  const { lien } = useActivite()
  const { modesDEmploi, support, nomCourt } = useOrganisation()
  const version = useQuery(VERSION).data?.versionInstallation
  const [notesOuvertes, setNotesOuvertes] = useState(false)
  const [installationOuverte, setInstallationOuverte] = useState(false)
  // Les invitations d'autres organisations qui attendent l'accord de la personne
  // (ADR 0030). Sans invitation, l'entrée n'apparaît pas.
  const invitations = useMesInvitations()
  const [invitationsOuvertes, setInvitationsOuvertes] = useState(false)
  const entreeInvitations =
    invitations.length === 0
      ? []
      : [
          {
            key: 'invitations',
            icon: <MailOutlined />,
            label:
              invitations.length === 1
                ? '1 invitation en attente'
                : `${invitations.length} invitations en attente`,
          },
          { type: 'divider' as const },
        ]
  // L'entrée n'a plus d'objet dans l'application déjà installée.
  const entreeInstallation = estInstallee()
    ? []
    : [
        {
          key: 'installer',
          icon: <DownloadOutlined />,
          label: 'Installer l’application',
        },
      ]
  const entreeSupport =
    support === null
      ? []
      : [
          {
            key: 'support',
            icon: <CustomerServiceOutlined />,
            // Un mail s'ouvre dans la messagerie de la personne ; une page
            // d'assistance, dans un nouvel onglet.
            label: (
              <a
                href={lienSupport(support, nomCourt, version)}
                {...(ouvreUnOnglet(support)
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                Support
              </a>
            ),
          },
        ]
  const choixOrganisation =
    organisations.length > 1
      ? [
          {
            type: 'group' as const,
            label: 'Organisation',
            children: organisations.map(o => ({
              key: `organisation:${o.slug}`,
              icon: o.active ? <CheckOutlined /> : <span />,
              label: o.nom,
            })),
          },
          { type: 'divider' as const },
        ]
      : []
  return (
    <>
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: [
            ...entreeInvitations,
            ...choixOrganisation,
            {
              key: 'preferences',
              icon: <SettingOutlined />,
              label: 'Préférences',
            },
            {
              key: 'modes-d-emploi',
              icon: <QuestionCircleOutlined />,
              // Le site public s'ouvre dans un nouvel onglet, hors du routeur.
              label: (
                <a
                  href={modesDEmploi}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Modes d’emploi
                </a>
              ),
            },
            ...entreeInstallation,
            ...entreeSupport,
            {
              key: 'notes-de-version',
              icon: <TagOutlined />,
              label: (
                <>
                  Notes de version
                  {version !== undefined && (
                    <span className="rt-mono rt-compte-version">{version}</span>
                  )}
                </>
              ),
            },
            { type: 'divider' },
            {
              key: 'deconnexion',
              icon: <LogoutOutlined />,
              label: 'Se déconnecter',
            },
          ],
          onClick: ({ key }) => {
            if (key === 'preferences') navigate(lien('/preferences'))
            if (key === 'notes-de-version') setNotesOuvertes(true)
            if (key === 'installer') setInstallationOuverte(true)
            if (key === 'invitations') setInvitationsOuvertes(true)
            if (key === 'deconnexion') void deconnecter()
            if (key.startsWith('organisation:')) {
              const slug = key.slice('organisation:'.length)
              if (!organisations.find(o => o.slug === slug)?.active) {
                void changerOrganisation(slug)
              }
            }
          },
        }}
      >
        <button
          type="button"
          className="rt-compte-bouton"
          aria-label={`Compte de ${nom}`}
        >
          <Badge dot={invitations.length > 0} offset={[-2, 4]}>
            <Avatar nom={nom} encre />
          </Badge>
          {afficherNom && <span>{nom}</span>}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: 'var(--rt-encre-55)' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </Dropdown>
      <NotesDeVersion
        ouvert={notesOuvertes}
        version={version}
        onFermer={() => setNotesOuvertes(false)}
      />
      <MesInvitations
        ouvert={invitationsOuvertes}
        onFermer={() => setInvitationsOuvertes(false)}
      />
      <InstallerApplication
        ouvert={installationOuverte}
        onFermer={() => setInstallationOuverte(false)}
      />
    </>
  )
}
