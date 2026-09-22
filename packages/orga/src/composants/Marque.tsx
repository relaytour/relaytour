import { useContext } from 'react'

import { ContexteActivite } from '../lib/activite'
import { useOrganisation } from '../lib/organisation'

// Le pictogramme de Relaytour : deux arcs qui se passent le relais. Le premier
// prend la primaire du thème, le second son accent. Il reste lisible à 16 px.
export function Pictogramme({
  taille = 28,
  monochrome = false,
}: {
  taille?: number
  monochrome?: boolean
}) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 10 37 A 15 15 0 0 1 40 37"
        fill="none"
        stroke={monochrome ? 'currentColor' : 'var(--rt-primaire)'}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path
        d="M 24 27 A 15 15 0 0 0 54 27"
        fill="none"
        stroke={monochrome ? 'currentColor' : 'var(--rt-accent)'}
        strokeWidth={9}
        strokeLinecap="round"
        opacity={monochrome ? 0.55 : 1}
      />
    </svg>
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
      <span className="rt-marque-nom">{libelle}</span>
    </span>
  )
}

/**
 * La signature de Relaytour, en pied de la barre latérale et de l'écran de
 * connexion : le logiciel libre qui fait tourner l'espace, et le lien vers son
 * code source, que l'AGPL oblige à proposer (article 13).
 */
export function SignatureRelaytour() {
  const { codeSource } = useOrganisation()
  return (
    <div className="rt-pied-marque">
      <span style={{ display: 'inline-flex', color: 'var(--rt-encre-40)' }}>
        <Pictogramme taille={14} monochrome />
      </span>
      <span>
        Propulsé par Relaytour ·{' '}
        <a
          href={codeSource}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', textDecoration: 'underline' }}
        >
          code source
        </a>
      </span>
    </div>
  )
}
