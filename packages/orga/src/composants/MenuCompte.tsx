import {
  CheckOutlined,
  CustomerServiceOutlined,
  DownloadOutlined,
  LogoutOutlined,
  MailOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
  SettingOutlined,
  TagOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Badge, Dropdown } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { graphql } from '../gql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import { estInstallee } from '../lib/installation'
import { useMesInvitations } from '../lib/invitations'
import { VERSION } from '../lib/notes-de-version'
import { useOrganisation } from '../lib/organisation'
import {
  useChangerOrganisation,
  useDeconnexion,
  useSession,
} from '../lib/session'

import { PREMIERS_PAS } from '../lib/requetes'
import { lienSupport, ouvreUnOnglet } from '../lib/support'

import InstallerApplication from './InstallerApplication'
import MesInvitations from './MesInvitations'
import NotesDeVersion from './NotesDeVersion'
import { Avatar } from './Personne'

const AFFICHER_PREMIERS_PAS = graphql(`
  mutation AfficherPremiersPas {
    afficherPremiersPas {
      masques
    }
  }
`)

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
  const { t } = useLingui()
  const navigate = useNavigate()
  const deconnecter = useDeconnexion()
  const { organisations } = useSession()
  const changerOrganisation = useChangerOrganisation()
  const { message } = App.useApp()
  const { lien, gere } = useActivite()
  // La liste « Premiers pas » masquée se réaffiche d'ici, tant qu'une étape reste
  // à faire (ADR 0048).
  const premiersPas = useQuery(PREMIERS_PAS, { skip: !gere }).data?.premiersPas
  const [afficherPremiersPas] = useMutation(AFFICHER_PREMIERS_PAS, {
    refetchQueries: [PREMIERS_PAS],
  })
  const entreePremiersPas =
    premiersPas?.masques && !premiersPas.termines
      ? [
          {
            key: 'premiers-pas',
            icon: <RocketOutlined />,
            label: t`Afficher les premiers pas`,
          },
        ]
      : []
  const { modesDEmploi, support, nomCourt } = useOrganisation()
  const version = useQuery(VERSION).data?.versionInstallation
  const [notesOuvertes, setNotesOuvertes] = useState(false)
  const [installationOuverte, setInstallationOuverte] = useState(false)
  // Les invitations d'autres organisations qui attendent l'accord de la personne
  // (ADR 0030). Sans invitation, l'entrée n'apparaît pas.
  const invitations = useMesInvitations()
  const [invitationsOuvertes, setInvitationsOuvertes] = useState(false)
  const nombreInvitations = invitations.length
  const entreeInvitations =
    invitations.length === 0
      ? []
      : [
          {
            key: 'invitations',
            icon: <MailOutlined />,
            label: t`${plural(nombreInvitations, {
              one: '# invitation en attente',
              other: '# invitations en attente',
            })}`,
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
          label: t`Installer l’application`,
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
                <Trans>Support</Trans>
              </a>
            ),
          },
        ]
  const choixOrganisation =
    organisations.length > 1
      ? [
          {
            type: 'group' as const,
            label: t`Organisation`,
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
              label: t`Préférences`,
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
                  <Trans>Modes d’emploi</Trans>
                </a>
              ),
            },
            ...entreePremiersPas,
            ...entreeInstallation,
            ...entreeSupport,
            {
              key: 'notes-de-version',
              icon: <TagOutlined />,
              label: (
                <>
                  <Trans>Notes de version</Trans>
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
              label: t`Se déconnecter`,
            },
          ],
          onClick: ({ key }) => {
            if (key === 'preferences') navigate(lien('/preferences'))
            if (key === 'notes-de-version') setNotesOuvertes(true)
            if (key === 'installer') setInstallationOuverte(true)
            if (key === 'invitations') setInvitationsOuvertes(true)
            if (key === 'premiers-pas') {
              afficherPremiersPas()
                .then(() => navigate(lien('/')))
                .catch((e: unknown) => message.error(messageErreur(e)))
            }
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
          aria-label={t`Compte de ${nom}`}
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
