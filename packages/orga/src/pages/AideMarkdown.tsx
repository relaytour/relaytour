import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from 'react-router'

import GuideMarkdown from '../composants/GuideMarkdown'
import Titre from '../composants/Titre'
import { useActivite } from '../lib/activite'

/** La page d'aide sur la syntaxe Markdown des fiches (/:activite/aide/markdown). */
export default function AideMarkdown() {
  const { t } = useLingui()
  const { lien } = useActivite()
  return (
    <>
      <Titre
        avant={
          <nav aria-label={t`Fil d’Ariane`} className="rt-ariane">
            <Link to={lien('/fiches')}>{t`Ressources`}</Link>
            <span aria-hidden="true">/</span>
            <span>{t`Aide`}</span>
          </nav>
        }
        sousTitre={t`Les fiches s’écrivent en Markdown : quelques signes placés dans le texte donnent les titres, les listes et les liens. Ce guide présente tous les signes que les fiches affichent.`}
      >
        <Trans>Écrire une fiche en Markdown</Trans>
      </Titre>
      <GuideMarkdown />
    </>
  )
}
