import { GUIDE_MARKDOWN } from '../lib/guide-markdown'
import Markdown from './Markdown'
import { Panneau } from './Panneau'

/**
 * Le guide de la syntaxe des fiches : pour chaque notion, le texte à écrire et
 * son affichage, rendu par le même composant que les fiches. `compact` empile
 * les deux, pour un tiroir étroit.
 */
export default function GuideMarkdown({
  compact = false,
}: {
  compact?: boolean
}) {
  return (
    <div className="rt-guide-markdown">
      {GUIDE_MARKDOWN.map(section => (
        <Panneau key={section.id} titre={section.titre}>
          <div id={`guide-${section.id}`}>
            {section.explications.map(texte => (
              <p key={texte} className="rt-guide-explication">
                {texte}
              </p>
            ))}
            <div
              className={`rt-guide-exemple${compact ? ' rt-guide-exemple-compact' : ''}`}
            >
              <figure>
                <figcaption>Vous écrivez</figcaption>
                <pre className="rt-guide-source">{section.exemple}</pre>
              </figure>
              <figure>
                <figcaption>La fiche affiche</figcaption>
                <div className="rt-guide-rendu">
                  <Markdown contenu={section.exemple} />
                </div>
              </figure>
            </div>
          </div>
        </Panneau>
      ))}
    </div>
  )
}
