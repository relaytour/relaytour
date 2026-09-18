import { colors, fonts } from '@relaytour/tokens'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Rendu Markdown des fiches. Le HTML brut n'est jamais interprété (comportement
// par défaut de react-markdown) : une fiche ne peut pas injecter de script.
export default function Markdown({ contenu }: { contenu: string }) {
  return (
    <>
      <style>{`
        .rt-markdown { font-size: 16px; line-height: 1.6; color: ${colors.marine}; }
        .rt-markdown h1, .rt-markdown h2 {
          font-family: ${fonts.display}; font-weight: 400; letter-spacing: .02em;
          margin: 1.6em 0 .4em; line-height: 1.1;
        }
        .rt-markdown h1 { font-size: 34px; }
        .rt-markdown h2 { font-size: 28px; border-bottom: 2px solid ${colors.sable}; padding-bottom: 4px; }
        .rt-markdown h3 { font-size: 18px; margin: 1.2em 0 .3em; }
        .rt-markdown > :first-child { margin-top: 0; }
        .rt-markdown ul, .rt-markdown ol { padding-inline-start: 1.4em; }
        .rt-markdown li { margin: .25em 0; }
        .rt-markdown a { color: ${colors.marine}; text-decoration: underline; }
        .rt-markdown blockquote {
          margin: 1em 0; padding: .5em 1em; background: ${colors.papier};
          border-inline-start: 4px solid ${colors.corail}; border-radius: 6px;
        }
        .rt-markdown code { background: ${colors.sable}; padding: 1px 5px; border-radius: 4px; }
        .rt-markdown table { border-collapse: collapse; display: block; overflow-x: auto; }
        .rt-markdown th, .rt-markdown td { border: 1px solid ${colors.sable}; padding: 6px 10px; }
      `}</style>
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
    </>
  )
}
