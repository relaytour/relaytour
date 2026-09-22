import { SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { AutoComplete, Input } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { graphql } from '../gql'
import { EDITION_COURANTE } from '../lib/requetes'

import EtiquettePerimetre from './EtiquettePerimetre'

const RECHERCHE = graphql(`
  query RechercheGlobale($texte: String!, $editionId: ID) {
    recherche(texte: $texte, editionId: $editionId) {
      taches {
        id
        titre
        edition {
          id
        }
        perimetre {
          id
          slug
          nom
          couleur
        }
      }
      fiches {
        id
        slug
        titre
        perimetre {
          id
          nom
          couleur
        }
      }
      personnes {
        id
        nom
        perimetres {
          id
          slug
          nom
        }
      }
    }
  }
`)

const LONGUEUR_MIN = 2
// Le serveur refuse une recherche plus longue : le champ l'empêche.
const LONGUEUR_MAX = 100
const DELAI_MS = 250

/**
 * La recherche globale de la barre haute : tâches de l'édition courante, fiches
 * et personnes. Le serveur ne renvoie que ce que la personne peut déjà lire.
 */
export default function Recherche({ estAdmin }: { estAdmin: boolean }) {
  const navigate = useNavigate()
  const [saisie, setSaisie] = useState('')
  const [texte, setTexte] = useState('')
  const { data: courante } = useQuery(EDITION_COURANTE)
  const editionId = courante?.editionCourante?.id

  // La requête part après une courte pause dans la frappe.
  useEffect(() => {
    const minuteur = setTimeout(() => setTexte(saisie.trim()), DELAI_MS)
    return () => clearTimeout(minuteur)
  }, [saisie])

  const { data, loading } = useQuery(RECHERCHE, {
    variables: { texte, editionId },
    skip: texte.length < LONGUEUR_MIN,
  })

  const { options, liens } = useMemo(() => {
    const liens = new Map<string, string>()
    const r = texte.length >= LONGUEUR_MIN ? data?.recherche : undefined
    if (!r) return { options: [], liens }
    const groupes = []
    if (r.taches.length > 0) {
      groupes.push({
        label: 'Tâches',
        options: r.taches.map(t => {
          const cle = `tache:${t.id}`
          liens.set(
            cle,
            `/perimetres/${t.perimetre.slug}?edition=${t.edition.id}`
          )
          return {
            value: cle,
            label: (
              <span className="rt-resultat">
                <span className="rt-resultat-titre">{t.titre}</span>
                <EtiquettePerimetre
                  nom={t.perimetre.nom}
                  couleur={t.perimetre.couleur}
                />
              </span>
            ),
          }
        }),
      })
    }
    if (r.fiches.length > 0) {
      groupes.push({
        label: 'Fiches',
        options: r.fiches.map(f => {
          const cle = `fiche:${f.id}`
          liens.set(cle, `/fiches/${f.slug}`)
          return {
            value: cle,
            label: (
              <span className="rt-resultat">
                <span className="rt-resultat-titre">{f.titre}</span>
                {f.perimetre ? (
                  <EtiquettePerimetre
                    nom={f.perimetre.nom}
                    couleur={f.perimetre.couleur}
                  />
                ) : (
                  <span className="rt-compte">Commune</span>
                )}
              </span>
            ),
          }
        }),
      })
    }
    if (r.personnes.length > 0) {
      groupes.push({
        label: 'Personnes',
        options: r.personnes.map(p => {
          const cle = `personne:${p.id}`
          const premier = p.perimetres[0]
          liens.set(
            cle,
            estAdmin
              ? '/admin/personnes'
              : premier
                ? `/perimetres/${premier.slug}`
                : '/'
          )
          return {
            value: cle,
            label: (
              <span className="rt-resultat">
                <span className="rt-resultat-titre">{p.nom}</span>
                <span className="rt-compte">
                  {p.perimetres.map(x => x.nom).join(', ')}
                </span>
              </span>
            ),
          }
        }),
      })
    }
    return { options: groupes, liens }
  }, [data, texte, estAdmin])

  const vide =
    texte.length >= LONGUEUR_MIN && !loading && data && options.length === 0

  return (
    <AutoComplete
      className="rt-recherche"
      value={saisie}
      options={options}
      onChange={setSaisie}
      onSelect={(cle: string) => {
        const lien = liens.get(cle)
        setSaisie('')
        setTexte('')
        if (lien) navigate(lien)
      }}
      notFoundContent={vide ? 'Aucun résultat.' : null}
      popupMatchSelectWidth={420}
    >
      <Input
        allowClear
        maxLength={LONGUEUR_MAX}
        aria-label="Rechercher une tâche, une fiche ou une personne"
        placeholder="Rechercher une tâche, une fiche, une personne"
        prefix={
          <SearchOutlined aria-hidden style={{ color: 'var(--rt-encre-55)' }} />
        }
      />
    </AutoComplete>
  )
}
