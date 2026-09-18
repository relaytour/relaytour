import { Progress, Space, Tag } from 'antd'

export interface AvancementDonnees {
  total: number
  faites: number
  abandonnees: number
  enRetard: number
  sansPersonne: number
}

/** Barre de progression : tâches faites sur tâches non abandonnées. */
export default function Avancement({
  avancement,
  compact = false,
}: {
  avancement: AvancementDonnees
  compact?: boolean
}) {
  const utiles = avancement.total - avancement.abandonnees
  const pourcentage =
    utiles === 0 ? 0 : Math.round((avancement.faites / utiles) * 100)
  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
      <Progress
        percent={pourcentage}
        size={compact ? 'small' : 'medium'}
        strokeColor="var(--rt-primaire)"
        format={() => `${avancement.faites} / ${utiles}`}
      />
      <Space size={[6, 6]} wrap>
        {avancement.enRetard > 0 && (
          <Tag color="red">{avancement.enRetard} en retard</Tag>
        )}
        {avancement.sansPersonne > 0 && (
          <Tag color="orange">{avancement.sansPersonne} sans personne</Tag>
        )}
        {utiles === 0 && <Tag>Aucune tâche</Tag>}
      </Space>
    </Space>
  )
}
