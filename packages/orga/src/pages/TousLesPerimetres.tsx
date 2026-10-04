import { CheckOutlined, StarOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { Alert, App, Button, Col, Empty, Row, Skeleton, Tag } from 'antd'
import { Link } from 'react-router'

import { Section } from '../composants/Panneau'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { TousLesPerimetresQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'

// Tous les périmètres de l'activité affichée (ADR 0012) : les affectations de la
// personne, ses souhaits, puis les autres périmètres, chacun avec sa description.
// La page ne montre ni tâche, ni fiche, ni nom de personne. Le nombre de personnes
// encore recherchées est une information : il n'empêche aucun souhait.
// Une personne qui voit l'activité ouvre chaque périmètre en consultation
// (ADR 0014). Une personne en découverte n'a pas ce lien.

const TOUS = graphql(`
  query TousLesPerimetres {
    tousLesPerimetres {
      edition {
        id
        nom
      }
      perimetres {
        affecte
        souhaite
        personnesRecherchees
        perimetre {
          id
          slug
          nom
          description
          groupe
          couleur
        }
      }
    }
  }
`)

const FORMULER = graphql(`
  mutation FormulerSouhait($perimetreId: ID!, $editionId: ID!) {
    formulerSouhait(perimetreId: $perimetreId, editionId: $editionId)
  }
`)

const RETIRER = graphql(`
  mutation RetirerMonSouhait($perimetreId: ID!, $editionId: ID!) {
    retirerMonSouhait(perimetreId: $perimetreId, editionId: $editionId)
  }
`)

type Ligne = TousLesPerimetresQuery['tousLesPerimetres']['perimetres'][number]

function libelleRecherche(nombre: number): string {
  if (nombre === 0) return 'L’équipe est au complet.'
  return nombre === 1
    ? '1 personne recherchée'
    : `${nombre} personnes recherchées`
}

export default function TousLesPerimetres() {
  const { activite, lien, libelleGroupe, decouverte } = useActivite()
  const { message } = App.useApp()
  const { data, loading } = useQuery(TOUS)
  const rafraichir = { refetchQueries: ['TousLesPerimetres'] }
  const [formuler, formulation] = useMutation(FORMULER, rafraichir)
  const [retirer, retrait] = useMutation(RETIRER, rafraichir)

  if (loading && data === undefined) return <Skeleton active />
  const edition = data?.tousLesPerimetres.edition ?? null
  const lignes = data?.tousLesPerimetres.perimetres ?? []

  const executer = async (action: () => Promise<unknown>, succes: string) => {
    try {
      await action()
      message.success(succes)
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const carte = (ligne: Ligne) => {
    const { perimetre } = ligne
    const variables =
      edition === null
        ? null
        : { perimetreId: perimetre.id, editionId: edition.id }
    const action = ligne.affecte ? (
      <Link to={lien(`/perimetres/${perimetre.slug}`)}>
        Ouvrir le périmètre
      </Link>
    ) : ligne.souhaite ? (
      <Button
        size="small"
        loading={retrait.loading}
        disabled={variables === null}
        onClick={() =>
          variables &&
          void executer(
            () => retirer({ variables }),
            'Votre souhait est retiré.'
          )
        }
      >
        Retirer mon souhait
      </Button>
    ) : (
      <Button
        size="small"
        type="primary"
        icon={<StarOutlined aria-hidden />}
        loading={formulation.loading}
        disabled={variables === null}
        aria-label={`Je suis intéressé·e par ${perimetre.nom}`}
        onClick={() =>
          variables &&
          void executer(
            () => formuler({ variables }),
            'Votre souhait est noté. Un admin confirme ensuite les affectations.'
          )
        }
      >
        Je suis intéressé·e
      </Button>
    )
    return (
      <Col key={perimetre.id} xs={24} md={12} xl={8}>
        <div
          className="rt-verre"
          style={{
            // Sans border-box, la marge interne et la bande de couleur s'ajoutent à
            // la hauteur de la colonne : la carte recouvre alors la rangée suivante.
            boxSizing: 'border-box',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '16px 18px',
            borderRadius: 16,
            borderTop: `6px solid ${perimetre.couleur ?? 'var(--rt-primaire)'}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 8,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              {perimetre.nom}
            </h3>
            {ligne.affecte ? (
              <Tag color="green" icon={<CheckOutlined aria-hidden />}>
                Affecté·e
              </Tag>
            ) : ligne.souhaite ? (
              <Tag color="gold" icon={<StarOutlined aria-hidden />}>
                Souhait
              </Tag>
            ) : (
              <span className="rt-libelle">
                {libelleGroupe(perimetre.groupe)}
              </span>
            )}
          </div>
          <p
            className={
              perimetre.description ? undefined : 'rt-texte-secondaire'
            }
            style={{ margin: 0, flex: 1 }}
          >
            {perimetre.description ?? 'Aucune description pour ce périmètre.'}
          </p>
          {ligne.personnesRecherchees !== null && (
            <p
              className="rt-texte-secondaire"
              style={{
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <TeamOutlined aria-hidden />
              {libelleRecherche(ligne.personnesRecherchees)}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px 14px',
            }}
          >
            {action}
            {!decouverte && !ligne.affecte && (
              <Link
                to={lien(`/perimetres/${perimetre.slug}`)}
                aria-label={`Consulter les tâches de ${perimetre.nom}`}
              >
                Consulter les tâches
              </Link>
            )}
          </div>
        </div>
      </Col>
    )
  }

  // Un bloc range ses périmètres par groupe, dans l'ordre déclaré par l'activité.
  const bloc = (titre: string, contenu: Ligne[], vide?: string) => {
    if (contenu.length === 0 && vide === undefined) return null
    return (
      <Section titre={titre} compte={contenu.length}>
        {contenu.length === 0 ? (
          <p className="rt-texte-secondaire">{vide}</p>
        ) : (
          activite.groupes
            .map(g => ({
              groupe: g,
              lignes: contenu.filter(l => l.perimetre.groupe === g.cle),
            }))
            .filter(g => g.lignes.length > 0)
            .map(({ groupe, lignes: duGroupe }) => (
              <section key={groupe.cle} style={{ marginBottom: 12 }}>
                <h3 className="rt-libelle" style={{ margin: '4px 0 10px' }}>
                  {libelleGroupe(groupe.cle, true)}
                </h3>
                <Row gutter={[12, 12]}>{duGroupe.map(carte)}</Row>
              </section>
            ))
        )}
      </Section>
    )
  }

  const affectes = lignes.filter(l => l.affecte)
  const souhaites = lignes.filter(l => !l.affecte && l.souhaite)
  const autres = lignes.filter(l => !l.affecte && !l.souhaite)

  return (
    <>
      <Titre
        sousTitre={
          edition === null
            ? `Les périmètres de ${activite.nom}.`
            : `Les périmètres de ${edition.nom}. Choisissez ceux qui vous intéressent : un admin confirme ensuite les affectations.`
        }
      >
        Tous les périmètres
      </Titre>
      {edition === null && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Aucune période n’est en préparation. Les souhaits se formulent quand une période s’ouvre."
        />
      )}
      {decouverte && affectes.length === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Vous n’avez pas encore de périmètre dans cette activité. Formulez vos souhaits : un admin vous affectera ensuite."
        />
      )}
      {lignes.length === 0 ? (
        <Empty description="Cette activité n’a encore aucun périmètre." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {bloc('Vos périmètres', affectes)}
          {bloc('Vos souhaits', souhaites)}
          {bloc(
            affectes.length + souhaites.length > 0
              ? 'Autres périmètres'
              : 'Les périmètres',
            autres,
            'Vous suivez déjà tous les périmètres de cette activité.'
          )}
        </div>
      )}
    </>
  )
}
