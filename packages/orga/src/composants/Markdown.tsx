import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { remarkMentions, type Mentions } from '../lib/mentions'
import Mention from './Mention'

// Rendu Markdown des fiches. Le HTML brut n'est jamais interprété (comportement
// par défaut de react-markdown) : une fiche ne peut pas injecter de script.
// Avec `mentions`, `@périmètre` et `@groupe:clé` s'affichent en étiquettes
// (ADR 0039). Les règles de style vivent dans global.css (.rt-markdown).
export default function Markdown({
  contenu,
  mentions,
}: {
  contenu: string
  mentions?: Mentions
}) {
  const extensions = useMemo(
    () => [remarkGfm, remarkMentions(mentions)],
    [mentions]
  )
  return (
    <div className="rt-markdown">
      <ReactMarkdown
        remarkPlugins={extensions}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          span: ({ children, ...props }) => {
            const cible = (props as Record<string, unknown>)['data-mention']
            return typeof cible === 'string' && mentions !== undefined ? (
              <Mention cible={cible} mentions={mentions}>
                {children}
              </Mention>
            ) : (
              <span>{children}</span>
            )
          },
        }}
      >
        {contenu}
      </ReactMarkdown>
    </div>
  )
}
