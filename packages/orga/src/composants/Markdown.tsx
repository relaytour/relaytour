import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Rendu Markdown des fiches. Le HTML brut n'est jamais interprété (comportement
// par défaut de react-markdown) : une fiche ne peut pas injecter de script.
// Les règles de style vivent dans global.css (.rt-markdown).
export default function Markdown({ contenu }: { contenu: string }) {
  return (
    <div className="rt-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {contenu}
      </ReactMarkdown>
    </div>
  )
}
