import { SolutionOutlined } from '@ant-design/icons'
import { Button, Card, Space, Tag, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import Avancement, { type AvancementDonnees } from './Avancement'

interface Props {
  perimetre: { nom: string; couleur?: string | null }
  /** Libellé du groupe du périmètre. */
  groupe: string
  /** Absent quand le périmètre n'a aucune tâche pour la période. */
  avancement: AvancementDonnees | undefined
  affectations: readonly {
    id: string
    contactPrincipal: boolean
    personne: { nom: string }
  }[]
  /** Le compteur « personnes affectées / effectif » de la vue « Équipe ». */
  compte: ReactNode
  /** L'adresse de la page du périmètre. */
  versPerimetre: string
  /** Passe à la vue « Équipe », sur ce périmètre. */
  gererEquipe: () => void
}

/** Carte d'un périmètre dans la vue « Avancement » de l'écran « Équipe ». */
export default function CarteAvancement({
  perimetre,
  groupe,
  avancement,
  affectations,
  compte,
  versPerimetre,
  gererEquipe,
}: Props) {
  return (
    <Card
      title={
        <Space wrap size={8}>
          <Link to={versPerimetre}>{perimetre.nom}</Link>
          <Tag>{groupe}</Tag>
        </Space>
      }
      extra={
        <Space size={4}>
          {compte}
          <Tooltip title="Gérer l’équipe de ce périmètre">
            <Button
              type="text"
              size="small"
              icon={<SolutionOutlined />}
              aria-label={`Gérer l’équipe du périmètre ${perimetre.nom}`}
              onClick={gererEquipe}
            />
          </Tooltip>
        </Space>
      }
      style={{
        borderTop: `6px solid ${perimetre.couleur ?? 'var(--rt-primaire)'}`,
        height: '100%',
      }}
    >
      {avancement === undefined ? (
        <span style={{ color: 'var(--rt-encre-70)' }}>Aucune tâche.</span>
      ) : (
        <Avancement avancement={avancement} compact />
      )}
      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
        {affectations.length > 0
          ? affectations
              .map(a =>
                a.contactPrincipal
                  ? `${a.personne.nom} (contact principal)`
                  : a.personne.nom
              )
              .join(', ')
          : 'Aucune personne affectée'}
      </div>
    </Card>
  )
}
