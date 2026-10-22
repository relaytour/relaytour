import { useContext } from 'react'

import { ContexteActivite } from '../lib/activite'
import { ORGANISATION_PAR_DEFAUT, useOrganisation } from '../lib/organisation'

// Le pictogramme de Relaytour : deux arcs entrelacés qui se passent le relais.
// Le premier prend la primaire du thème, le second son accent. Le second arc
// recouvre le premier, puis l'extrémité droite du premier repasse au-dessus.
// Le trait de 8 reste lisible à 16 px ; les grandes icônes portent un trait
// de 9 (packages/orga/public/icon.png).
export function Pictogramme({
  taille = 28,
  monochrome = false,
}: {
  taille?: number
  monochrome?: boolean
}) {
  const premier = monochrome ? 'currentColor' : 'var(--rt-primaire)'
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth={8}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M 10 37 A 15 15 0 0 1 40 37" stroke={premier} />
      <path
        d="M 24 27 A 15 15 0 0 0 54 27"
        stroke={monochrome ? 'currentColor' : 'var(--rt-accent)'}
        opacity={monochrome ? 0.55 : 1}
      />
      <path d="M 37.99 29.5 A 15 15 0 0 1 40 37" stroke={premier} />
    </svg>
  )
}

/**
 * Le nom de Relaytour en logotype : Baloo 2 SemiBold, « Relay » en encre et
 * « tour » en accent. La marque l'affiche à la place du nom quand l'espace porte
 * l'identité de Relaytour elle-même : avant la réponse de l'API, ou dans une
 * installation qui n'a pas nommé son organisation.
 */
function Logotype() {
  return (
    <span className="rt-marque-nom rt-logotype">
      Relay<span className="rt-logotype-tour">tour</span>
    </span>
  )
}

/**
 * La marque affichée dans la barre latérale et sur l'écran de connexion : le
 * logo de l'activité affichée, sinon celui de l'organisation, sinon le
 * pictogramme de Relaytour (ADR 0009), puis le nom court de l'organisation servi
 * par l'API (ADR 0006).
 */
export default function Marque({
  nom,
  taille = 28,
}: {
  nom?: string
  taille?: number
}) {
  const organisation = useOrganisation()
  const activite = useContext(ContexteActivite)?.activite
  const libelle = nom ?? organisation.nomCourt
  const logo = activite?.logoUrl ?? organisation.logoUrl
  return (
    <span className="rt-marque">
      {logo !== null ? (
        <img
          src={logo}
          alt=""
          height={taille}
          style={{ display: 'block', maxWidth: taille * 3 }}
        />
      ) : (
        <Pictogramme taille={taille} />
      )}
      {logo === null && libelle === ORGANISATION_PAR_DEFAUT.nomCourt ? (
        <Logotype />
      ) : (
        <span className="rt-marque-nom">{libelle}</span>
      )}
    </span>
  )
}

/**
 * La signature de Relaytour, en pied de la barre latérale et de l'écran de
 * connexion : le logiciel libre qui fait tourner l'espace. Son nom porte le lien
 * vers le code source, que l'AGPL oblige à proposer (article 13).
 */
export function SignatureRelaytour({
  compacte = false,
}: {
  /** Dans le rail du volet de navigation : le pictogramme seul porte le lien. */
  compacte?: boolean
}) {
  const { codeSource } = useOrganisation()
  if (compacte)
    return (
      <div className="rt-pied-marque">
        <a
          href={codeSource}
          target="_blank"
          rel="noreferrer"
          aria-label="Propulsé par Relaytour : code source"
          title="Propulsé par Relaytour : code source"
          style={{ display: 'inline-flex', color: 'var(--rt-encre-40)' }}
        >
          <Pictogramme taille={16} monochrome />
        </a>
      </div>
    )
  return (
    <div className="rt-pied-marque">
      <span style={{ display: 'inline-flex', color: 'var(--rt-encre-40)' }}>
        <Pictogramme taille={14} monochrome />
      </span>
      <span>
        Propulsé par{' '}
        <a
          href={codeSource}
          target="_blank"
          rel="noreferrer"
          title="Code source de Relaytour"
          style={{ color: 'inherit', textDecoration: 'underline' }}
        >
          Relaytour
        </a>
      </span>
    </div>
  )
}
