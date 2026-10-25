import { Trans } from '@lingui/react/macro'
import { useMemo } from 'react'

import { guideMarkdown, mentionsDuGuide } from '../lib/guide-markdown'
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
  // L'application se remonte à chaque changement de langue : un calcul unique suffit.
  const sections = useMemo(() => guideMarkdown(), [])
  const mentions = useMemo(() => mentionsDuGuide(), [])
  return (
    <div className="rt-guide-markdown">
      {sections.map(section => (
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
                <figcaption>
                  <Trans>Vous écrivez</Trans>
                </figcaption>
                <pre className="rt-guide-source">{section.exemple}</pre>
              </figure>
              <figure>
                <figcaption>
                  <Trans>La fiche affiche</Trans>
                </figcaption>
                <div className="rt-guide-rendu">
                  <Markdown contenu={section.exemple} mentions={mentions} />
                </div>
              </figure>
            </div>
          </div>
        </Panneau>
      ))}
    </div>
  )
}
