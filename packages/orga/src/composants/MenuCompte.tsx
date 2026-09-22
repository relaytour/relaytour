import { LogoutOutlined, SettingOutlined } from '@ant-design/icons'
import { Dropdown } from 'antd'
import { useNavigate } from 'react-router'

import { useDeconnexion } from '../lib/session'

import { Avatar } from './Personne'

/** Le compte de la barre haute : initiales, nom, préférences et déconnexion. */
export default function MenuCompte({
  nom,
  afficherNom,
}: {
  nom: string
  afficherNom: boolean
}) {
  const navigate = useNavigate()
  const deconnecter = useDeconnexion()
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
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
          if (key === 'preferences') navigate('/preferences')
          if (key === 'deconnexion') void deconnecter()
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
