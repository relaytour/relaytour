import { InfoCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Popover, Select } from 'antd'

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
// message. Une icône signale les cibles qui demandent une précaution, et un
// bouton voisin du sélecteur en ouvre l'explication.

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

/** L'icône qui signale une cible : un avertissement pour une application, une information pour `mailto:`. */
function IconeMessagerie({ cle }: { cle: CleMessagerie }) {
  const { genre } = messagerie(cle)
  if (genre === 'web') return null
  return (
    <span
      className="rt-avis-messagerie-icone"
      aria-hidden
      style={{
        color:
          genre === 'application' ? 'var(--rt-alerte)' : 'var(--rt-encre-55)',
      }}
    >
      {genre === 'application' ? <WarningOutlined /> : <InfoCircleOutlined />}
    </span>
  )
}

/**
 * L'explication d'une cible, ouverte par un bouton que le clavier atteint. La
 * messagerie par défaut renvoie au réglage du système. Une application ouverte
 * par son schéma d'URL ne répond pas sur tous les appareils.
 */
export function AvisMessagerie({ cle }: { cle: CleMessagerie }) {
  const { genre, detail, systemes } = messagerie(cle)
  if (genre === 'web') return null
  const application = genre === 'application'
  const titre = application
    ? 'Ce lien ne fonctionne pas sur tous les appareils'
    : 'La messagerie par défaut se règle dans votre système'
  return (
    <Popover
      trigger={['hover', 'click']}
      title={titre}
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
      <Button
        type="text"
        shape="circle"
        size="small"
        icon={<IconeMessagerie cle={cle} />}
        aria-label={titre}
      />
    </Popover>
  )
}

interface Props {
  valeur: CleMessagerie
  choisir: (cle: CleMessagerie) => void
  style?: React.CSSProperties
}

/** Le sélecteur, puis le bouton d'explication de la cible choisie. */
export default function ChoixMessagerie({ valeur, choisir, style }: Props) {
  return (
    <span className="rt-choix-messagerie" style={style}>
      <Select<CleMessagerie>
        aria-label="Messagerie"
        value={valeur}
        onChange={choisir}
        style={{ flex: 1, minWidth: 0 }}
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
        // L'icône d'une option est décorative : le bouton voisin porte l'explication.
        optionRender={option => (
          <span className="rt-choix-messagerie-option">
            <span>{option.label}</span>
            <IconeMessagerie cle={option.value as CleMessagerie} />
          </span>
        )}
      />
      <AvisMessagerie cle={valeur} />
    </span>
  )
}
