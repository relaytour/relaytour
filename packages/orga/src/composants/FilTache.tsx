import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Drawer, Input, Skeleton } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import {
  COMMENTAIRE_MAX,
  COMMENTER_TACHE,
  composerFil,
  FIL_TACHE,
  instantDuFil,
  MODIFIER_COMMENTAIRE,
  SUPPRIMER_COMMENTAIRE,
  texteEvenement,
  type Commentaire,
  type Fil,
} from '../lib/commentaires'
import { messageErreur } from '../lib/erreurs'
import { decouperLiens } from '../lib/liens'

import { Avatar } from './Personne'
import { PuceBascule } from './Puces'

// Les compteurs des cartes suivent chaque écriture.
const A_RELIRE = ['CommentairesDeLaPeriode']

/**
 * Le texte d'un commentaire : un texte simple, dont les adresses `http` et
 * `https` deviennent des liens. Une adresse de l'espace organisateur s'ouvre
 * dans le même onglet, toute autre adresse dans un nouvel onglet (ADR 0029).
 */
export function TexteCommentaire({ texte }: { texte: string }) {
  return (
    <p className="rt-commentaire-texte">
      {decouperLiens(texte, window.location.origin).map((segment, i) =>
        segment.href === undefined ? (
          segment.texte
        ) : segment.interne !== null ? (
          <Link key={i} to={segment.interne}>
            {segment.texte}
          </Link>
        ) : (
          <a
            key={i}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {segment.texte}
          </a>
        )
      )}
    </p>
  )
}

/**
 * Le fil d'une tâche (ADR 0029), dans un volet : ses commentaires et les
 * événements de son journal, du plus ancien au plus récent, puis la saisie d'un
 * commentaire. Le fil se lit par une requête à part, à l'ouverture.
 */
export default function FilTache({
  tache,
  moiId,
  ouvert,
  onFermer,
}: {
  tache: { id: string; titre: string }
  moiId: string
  ouvert: boolean
  onFermer: () => void
}) {
  const { message, modal } = App.useApp()
  const { data, error, loading } = useQuery(FIL_TACHE, {
    variables: { id: tache.id },
    skip: !ouvert,
    fetchPolicy: 'cache-and-network',
  })
  // Chaque écriture rend le fil : il s'écrit dans le cache sans seconde lecture.
  const ranger = (fil: Fil | undefined, cache: { writeQuery: Ecrire }) => {
    if (fil)
      cache.writeQuery({
        query: FIL_TACHE,
        variables: { id: tache.id },
        data: { filTache: fil },
      })
  }
  const [commenter, envoi] = useMutation(COMMENTER_TACHE, {
    refetchQueries: A_RELIRE,
    update: (cache, r) => ranger(r.data?.commenterTache, cache),
  })
  const [modifier, modification] = useMutation(MODIFIER_COMMENTAIRE, {
    update: (cache, r) => ranger(r.data?.modifierCommentaire, cache),
  })
  const [supprimer] = useMutation(SUPPRIMER_COMMENTAIRE, {
    refetchQueries: A_RELIRE,
    update: (cache, r) => ranger(r.data?.supprimerCommentaire, cache),
  })

  const [texte, setTexte] = useState('')
  const [enEdition, setEnEdition] = useState<{ id: string; texte: string }>()
  const [avecHistorique, setAvecHistorique] = useState(true)
  const fil = data?.filTache
  const elements = fil ? composerFil(fil, avecHistorique) : []
  const fin = useRef<HTMLDivElement>(null)
  const nombre = elements.length
  // Le fil s'ouvre sur son dernier élément, et y revient à chaque ajout.
  useEffect(() => {
    if (ouvert && nombre > 0) fin.current?.scrollIntoView({ block: 'end' })
  }, [ouvert, nombre])

  const publier = async () => {
    const propre = texte.trim()
    if (propre === '' || envoi.loading) return
    try {
      await commenter({ variables: { id: tache.id, texte: propre } })
      setTexte('')
    } catch (erreur) {
      // La saisie reste à l'écran : la personne peut réessayer.
      message.error(messageErreur(erreur))
    }
  }

  const enregistrer = async () => {
    if (!enEdition) return
    const propre = enEdition.texte.trim()
    if (propre === '') return
    try {
      await modifier({ variables: { id: enEdition.id, texte: propre } })
      setEnEdition(undefined)
    } catch (erreur) {
      message.error(messageErreur(erreur))
    }
  }

  const retirer = async (commentaire: Commentaire) => {
    const confirme = await modal.confirm({
      title: 'Supprimer ce commentaire ?',
      content: 'La suppression est définitive.',
      okText: 'Supprimer',
      okButtonProps: { danger: true },
      cancelText: 'Annuler',
    })
    if (!confirme) return
    try {
      await supprimer({ variables: { id: commentaire.id } })
      message.success('Le commentaire est supprimé.')
    } catch (erreur) {
      message.error(messageErreur(erreur))
    }
  }

  return (
    <Drawer
      open={ouvert}
      onClose={onFermer}
      title={tache.titre}
      size={460}
      className="rt-fil-volet"
      extra={
        <PuceBascule actif={avecHistorique} onChange={setAvecHistorique}>
          Historique
        </PuceBascule>
      }
      footer={
        fil?.peutCommenter ? (
          <form
            className="rt-fil-saisie"
            onSubmit={e => {
              e.preventDefault()
              void publier()
            }}
          >
            <Input.TextArea
              value={texte}
              onChange={e => setTexte(e.target.value)}
              // Ctrl+Entrée ou Cmd+Entrée publie ; Entrée seule passe à la ligne.
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void publier()
                }
              }}
              autoSize={{ minRows: 2, maxRows: 8 }}
              maxLength={COMMENTAIRE_MAX}
              placeholder="Écrire un commentaire : un compte rendu, une information, une question."
              aria-label="Votre commentaire"
            />
            <Button
              type="primary"
              htmlType="submit"
              loading={envoi.loading}
              disabled={texte.trim() === ''}
            >
              Publier
            </Button>
          </form>
        ) : fil ? (
          <p className="rt-note" style={{ margin: 0 }}>
            Vous lisez ce fil sans pouvoir y écrire.
          </p>
        ) : undefined
      }
    >
      {fil === undefined ? (
        error ? (
          <p className="rt-note">
            Le fil n’a pas pu être chargé. Rechargez la page dans un instant.
          </p>
        ) : (
          loading && <Skeleton active />
        )
      ) : (
        <>
          {fil.nombreCommentaires > fil.commentaires.length && (
            <p className="rt-note">
              Le fil affiche les {fil.commentaires.length} derniers commentaires
              sur {fil.nombreCommentaires}.
            </p>
          )}
          {elements.length === 0 ? (
            <p className="rt-note">
              Aucun commentaire pour l’instant.
              {fil.peutCommenter &&
                ' Notez ici où vous en êtes : toute l’équipe du périmètre le lira.'}
            </p>
          ) : (
            <ol className="rt-fil">
              {elements.map(element =>
                element.sorte === 'evenement' ? (
                  <li key={element.evenement.id} className="rt-fil-evenement">
                    <span>{texteEvenement(element.evenement, moiId)}</span>
                    <time dateTime={element.le}>
                      {instantDuFil(element.le)}
                    </time>
                  </li>
                ) : (
                  <li
                    key={element.commentaire.id}
                    className="rt-fil-commentaire"
                  >
                    <Avatar
                      nom={element.commentaire.auteur?.nom ?? '?'}
                      taille={30}
                    />
                    <div className="rt-fil-commentaire-corps">
                      <p className="rt-fil-commentaire-tete">
                        <strong>
                          {element.commentaire.auteur === null
                            ? 'Compte supprimé'
                            : element.commentaire.auteur.id === moiId
                              ? 'Vous'
                              : element.commentaire.auteur.nom}
                        </strong>
                        <time dateTime={element.le}>
                          {instantDuFil(element.le)}
                        </time>
                        {element.commentaire.modifieLe && (
                          <span
                            title={`Modifié le ${instantDuFil(element.commentaire.modifieLe)}`}
                          >
                            modifié
                          </span>
                        )}
                      </p>
                      {enEdition?.id === element.commentaire.id ? (
                        <div className="rt-fil-edition">
                          <Input.TextArea
                            autoFocus
                            value={enEdition.texte}
                            onChange={e =>
                              setEnEdition({
                                id: enEdition.id,
                                texte: e.target.value,
                              })
                            }
                            autoSize={{ minRows: 2, maxRows: 10 }}
                            maxLength={COMMENTAIRE_MAX}
                            aria-label="Modifier votre commentaire"
                          />
                          <div className="rt-fil-actions">
                            <Button
                              size="small"
                              type="primary"
                              loading={modification.loading}
                              disabled={enEdition.texte.trim() === ''}
                              onClick={() => void enregistrer()}
                            >
                              Enregistrer
                            </Button>
                            <Button
                              size="small"
                              onClick={() => setEnEdition(undefined)}
                            >
                              Annuler
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <TexteCommentaire texte={element.commentaire.texte} />
                          {(element.commentaire.peutModifier ||
                            element.commentaire.peutSupprimer) && (
                            <div className="rt-fil-actions">
                              {element.commentaire.peutModifier && (
                                <Button
                                  size="small"
                                  type="link"
                                  onClick={() =>
                                    setEnEdition({
                                      id: element.commentaire.id,
                                      texte: element.commentaire.texte,
                                    })
                                  }
                                >
                                  Modifier
                                </Button>
                              )}
                              {element.commentaire.peutSupprimer && (
                                <Button
                                  size="small"
                                  type="link"
                                  danger
                                  onClick={() =>
                                    void retirer(element.commentaire)
                                  }
                                >
                                  Supprimer
                                </Button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                )
              )}
            </ol>
          )}
          <div ref={fin} />
        </>
      )}
    </Drawer>
  )
}

type Ecrire = (options: {
  query: typeof FIL_TACHE
  variables: { id: string }
  data: { filTache: Fil }
}) => unknown
