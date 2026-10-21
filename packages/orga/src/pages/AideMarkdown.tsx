import { Link } from 'react-router'

import GuideMarkdown from '../composants/GuideMarkdown'
import Titre from '../composants/Titre'
import { useActivite } from '../lib/activite'

/** La page d'aide sur la syntaxe Markdown des fiches (/:activite/aide/markdown). */
export default function AideMarkdown() {
  const { lien } = useActivite()
  return (
    <>
      <Titre
        avant={
          <nav aria-label="Fil d’Ariane" className="rt-ariane">
            <Link to={lien('/fiches')}>Fiches</Link>
            <span aria-hidden="true">/</span>
            <span>Aide</span>
          </nav>
        }
        sousTitre="Les fiches s’écrivent en Markdown : quelques signes placés dans le texte donnent les titres, les listes et les liens. Ce guide présente tous les signes que les fiches affichent."
      >
        Écrire une fiche en Markdown
      </Titre>
      <GuideMarkdown />
    </>
  )
}
