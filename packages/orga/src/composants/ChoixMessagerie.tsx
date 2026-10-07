import { InfoCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { Popover, Select } from 'antd'

import {
  GENRES,
  MESSAGERIES,
  lienGuideMessagerie,
  messagerie,
  type CleMessagerie,
  type GenreMessagerie,
} from '../lib/messagerie'
import { useOrganisation } from '../lib/organisation'

// Sélecteur de la messagerie qui reçoit un message (ADR 0022). Les préférences
// fixent le choix habituel, la fenêtre « Écrire un message » le change pour un
// message. Une icône signale les cibles qui demandent une précaution.

/** Le lien vers la page « Choisir votre messagerie » du site. */
export function LienGuideMessagerie({ children }: { children: string }) {
  const { modesDEmploi } = useOrganisation()
  return (
    <a
      href={lienGuideMessagerie(modesDEmploi)}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}

/**
 * L'icône d'une cible et son explication. La messagerie par défaut renvoie au
 * réglage du système. Une application ouverte par son schéma d'URL ne répond pas
 * sur tous les appareils.
 */
export function AvisMessagerie({ cle }: { cle: CleMessagerie }) {
  const { genre, detail, systemes } = messagerie(cle)
  if (genre === 'web') return null
  const application = genre === 'application'
  return (
    <Popover
      title={
        application
          ? 'Ce lien ne fonctionne pas sur tous les appareils'
          : 'La messagerie par défaut se règle dans votre système'
      }
      content={
        <div className="rt-avis-messagerie">
          <p>{detail}</p>
          {application ? (
            <>
              <p>Systèmes concernés : {systemes}.</p>
              <p>
                Les champs « Cc » et « Cci » ne sont pas garantis. Essayez cette
                application dans vos préférences avant de vous en servir.
              </p>
            </>
          ) : (
            <p>
              Si une autre application s’ouvre, vous pouvez changer ce réglage
              dans votre système ou dans votre navigateur.
            </p>
          )}
          <LienGuideMessagerie>
            {application
              ? 'Lire le mode d’emploi des messageries'
              : 'Régler la messagerie par défaut de votre système'}
          </LienGuideMessagerie>
        </div>
      }
    >
      <span
        className="rt-avis-messagerie-icone"
        role="img"
        aria-label={
          application
            ? 'Fonctionnement à vérifier sur cet appareil'
            : 'Réglage du système'
        }
        style={{
          color: application ? 'var(--rt-alerte)' : 'var(--rt-encre-55)',
        }}
      >
        {application ? <WarningOutlined /> : <InfoCircleOutlined />}
      </span>
    </Popover>
  )
}

const Libelle = ({ cle }: { cle: CleMessagerie }) => (
  <span className="rt-choix-messagerie">
    <span>{messagerie(cle).libelle}</span>
    <AvisMessagerie cle={cle} />
  </span>
)

interface Props {
  valeur: CleMessagerie
  choisir: (cle: CleMessagerie) => void
  style?: React.CSSProperties
}

export default function ChoixMessagerie({ valeur, choisir, style }: Props) {
  return (
    <Select<CleMessagerie>
      aria-label="Messagerie"
      value={valeur}
      onChange={choisir}
      style={style}
      popupMatchSelectWidth={false}
      // Les huit cibles et leurs trois titres se lisent sans défilement.
      listHeight={400}
      options={(Object.keys(GENRES) as GenreMessagerie[]).map(genre => ({
        label: GENRES[genre],
        options: MESSAGERIES.filter(m => m.genre === genre).map(m => ({
          value: m.cle,
          label: m.libelle,
        })),
      }))}
      optionRender={option => <Libelle cle={option.value as CleMessagerie} />}
      labelRender={({ value }) => <Libelle cle={value as CleMessagerie} />}
    />
  )
}
