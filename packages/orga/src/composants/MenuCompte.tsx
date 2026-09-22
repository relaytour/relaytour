import {
  CheckOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Dropdown } from 'antd'
import { useNavigate } from 'react-router'

import { useActivite } from '../lib/activite'
import {
  useChangerOrganisation,
  useDeconnexion,
  useSession,
} from '../lib/session'

import { Avatar } from './Personne'

/**
 * Le compte de la barre haute : initiales, nom, préférences, changement
 * d'organisation quand la personne en a plusieurs (ADR 0008), et déconnexion.
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
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          ...choixOrganisation,
          {
            key: 'preferences',
            icon: <SettingOutlined />,
            label: 'Préférences',
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
        <Avatar nom={nom} encre />
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
  )
}
