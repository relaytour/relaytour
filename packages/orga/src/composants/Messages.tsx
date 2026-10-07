import { CopyOutlined, MailOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Space, Tag, Tooltip, Typography } from 'antd'

import type { MessagesQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { jourDeLInstant, messageErreur } from '../lib/erreurs'
import {
  CHAMPS,
  adressesACopier,
  STATUTS_MESSAGE,
  libelleModele,
  preparerLien,
  repartir,
  type Destinataire,
  type StatutMessage,
} from '../lib/messages'
import { PERIMETRES } from '../lib/requetes'
import { DEFINIR_STATUT_MESSAGE, MESSAGES } from '../lib/requetes-messages'
import { useSession } from '../lib/session'
import { comparer } from '../lib/tableau'

import Tableau, { type ColonneTableau } from './Tableau'

// Historique des messages (ADR 0020). L'application n'envoie aucun de ces messages :
// chaque ligne garde ce qu'un admin a préparé, et l'état qu'il a déclaré après
// l'ouverture de sa messagerie.

type Message = MessagesQuery['messages'][number]

/** Valeur de filtre d'un message écrit depuis l'annuaire. */
const ANNUAIRE = 'annuaire'
/** Nombre de noms affichés au survol du nombre de destinataires. */
const NOMS_MAX = 12

interface Props {
  /** Vrai pour un admin de l'organisation : il lit les messages de toutes les activités. */
  annuaire: boolean
  /** Les personnes que l'écran affiche, avec leur adresse, pour rouvrir un message. */
  personnes: Destinataire[]
}

const unique = <T,>(valeurs: T[]) => [...new Set(valeurs)]

export default function Messages({ annuaire, personnes }: Props) {
  const { message, modal } = App.useApp()
  const { activite, activites } = useActivite()
  const { moi } = useSession()
  const { data, loading } = useQuery(MESSAGES, {
    variables: { activiteId: annuaire ? null : activite.id },
  })
  const { data: perimetres } = useQuery(PERIMETRES, {
    variables: { inclureArchives: true },
  })
  const [definirStatut] = useMutation(DEFINIR_STATUT_MESSAGE, {
    refetchQueries: ['Messages'],
  })

  const messages = data?.messages ?? []
  const nomActivite = (m: Message) =>
    m.activiteId === null
      ? 'Annuaire'
      : (activites.find(a => a.id === m.activiteId)?.nom ?? 'Autre activité')
  const nomPerimetre = (m: Message) =>
    perimetres?.perimetres.find(p => p.id === m.perimetreId)?.nom

  const declarer = async (m: Message, statut: StatutMessage) => {
    try {
      await definirStatut({ variables: { id: m.id, statut } })
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const copier = async (texte: string, succes: string) => {
    try {
      await navigator.clipboard.writeText(texte)
      message.success(succes)
    } catch {
      message.error(
        'La copie a échoué. Sélectionnez le texte, puis copiez-le vous-même.'
      )
    }
  }

  // Les adresses viennent de la liste affichée par l'écran : une personne qui n'y
  // figure plus garde son nom dans l'historique, sans adresse.
  const rouvrir = async (m: Message) => {
    const connues = new Map(personnes.map(p => [p.id, p]))
    const destinataires = m.destinataires.flatMap(d => {
      const personne = connues.get(d.personne.id)
      return personne === undefined ? [] : [personne]
    })
    const manquantes = m.destinataires.length - destinataires.length
    if (destinataires.length === 0) {
      message.warning(
        'Aucun destinataire de ce message ne figure dans la liste affichée : les adresses manquent.'
      )
      return
    }
    const enCopie = new Set(
      m.destinataires.filter(d => d.enCopie).map(d => d.personne.id)
    )
    const { lien, omis } = preparerLien({
      ...repartir(destinataires, m.champ, enCopie, moi.email),
      objet: m.objet,
      corps: m.corps,
    })
    const adresses = repartir(destinataires, m.champ, enCopie, moi.email)
    if (manquantes > 0) {
      message.warning(
        manquantes === 1
          ? 'Un destinataire ne figure plus dans la liste affichée : son adresse manque.'
          : `${manquantes} destinataires ne figurent plus dans la liste affichée : leurs adresses manquent.`
      )
    }
    if (omis !== 'rien') {
      // Le lien ne porte pas tout le message : l'admin copie ici ce qui manque,
      // puis ouvre sa messagerie.
      modal.info({
        title:
          omis === 'texte'
            ? 'Le texte est trop long pour le lien vers la messagerie'
            : 'Les destinataires sont trop nombreux pour le lien vers la messagerie',
        content: (
          <Space orientation="vertical" size={8}>
            <span>
              {omis === 'texte'
                ? 'La messagerie s’ouvre avec les destinataires et l’objet. Copiez le texte, puis collez-le dans le message.'
                : 'La messagerie s’ouvre avec l’objet seulement. Copiez les adresses et le texte, puis collez-les dans le message.'}
            </span>
            {(
              [
                ['a', m.champ === 'A' ? 'Copier l’adresse' : null],
                ['cc', 'Copier les adresses en Cc'],
                ['cci', 'Copier les adresses en Cci'],
              ] as const
            ).map(
              ([cle, libelle]) =>
                libelle !== null &&
                adresses[cle].length > 0 && (
                  <Button
                    key={cle}
                    icon={<CopyOutlined />}
                    onClick={() =>
                      void copier(
                        adressesACopier(adresses[cle]),
                        'Les adresses sont copiées.'
                      )
                    }
                  >
                    {libelle}
                  </Button>
                )
            )}
            <Button
              icon={<CopyOutlined />}
              onClick={() => void copier(m.corps, 'Le texte est copié.')}
            >
              Copier le texte
            </Button>
            <Button type="primary" icon={<MailOutlined />} href={lien}>
              Ouvrir la messagerie
            </Button>
          </Space>
        ),
        okText: 'Fermer',
      })
      return
    }
    const ancre = document.createElement('a')
    ancre.href = lien
    ancre.click()
  }

  const colonnes: ColonneTableau<Message>[] = [
    {
      key: 'creeLe',
      title: 'Préparé le',
      render: (_, m) => jourDeLInstant(m.creeLe),
      tri: m => m.creeLe,
    },
    {
      key: 'objet',
      title: 'Objet',
      tri: m => m.objet,
      recherche: m => m.objet,
      render: (_, m) => <span style={{ fontWeight: 600 }}>{m.objet}</span>,
    },
    {
      key: 'modele',
      title: 'Modèle',
      render: (_, m) => libelleModele(m.modele),
      filtre: {
        options: unique(messages.map(m => m.modele))
          .map(cle => ({ text: libelleModele(cle), value: cle }))
          .sort((a, b) => comparer(a.text, b.text)),
        valeurs: m => m.modele,
      },
    },
    ...(annuaire
      ? [
          {
            key: 'activite',
            title: 'Activité',
            render: (_: unknown, m: Message) => nomActivite(m),
            filtre: {
              options: unique(messages.map(m => m.activiteId ?? ANNUAIRE)).map(
                id => ({
                  text:
                    id === ANNUAIRE
                      ? 'Annuaire'
                      : (activites.find(a => a.id === id)?.nom ??
                        'Autre activité'),
                  value: id,
                })
              ),
              valeurs: (m: Message) => m.activiteId ?? ANNUAIRE,
            },
          } satisfies ColonneTableau<Message>,
        ]
      : []),
    {
      key: 'auteur',
      title: 'Écrit par',
      render: (_, m) => m.auteur?.nom ?? 'Compte supprimé',
      tri: m => m.auteur?.nom,
      filtre: {
        options: unique(messages.flatMap(m => m.auteur?.nom ?? []))
          .sort(comparer)
          .map(nom => ({ text: nom, value: nom })),
        valeurs: m => m.auteur?.nom ?? [],
      },
    },
    {
      key: 'destinataires',
      title: 'Destinataires',
      tri: m => m.destinataires.length,
      render: (_, m) => {
        const noms = m.destinataires.map(d => d.personne.nom)
        const reste = noms.length - NOMS_MAX
        return (
          <Tooltip
            title={
              reste > 0
                ? `${noms.slice(0, NOMS_MAX).join(', ')} et ${reste} de plus`
                : noms.join(', ')
            }
          >
            <span>
              {noms.length === 1 ? noms[0] : `${noms.length} personnes`} (
              {CHAMPS[m.champ]})
            </span>
          </Tooltip>
        )
      },
    },
    {
      key: 'statut',
      title: 'État',
      render: (_, m) => (
        <Space size={4} wrap>
          <Tag
            color={STATUTS_MESSAGE[m.statut].couleur}
            style={{ marginInlineEnd: 0 }}
          >
            {STATUTS_MESSAGE[m.statut].libelle}
          </Tag>
          {m.statutLe && (
            <Typography.Text type="secondary">
              le {jourDeLInstant(m.statutLe)}
            </Typography.Text>
          )}
        </Space>
      ),
      filtre: {
        options: Object.entries(STATUTS_MESSAGE).map(([value, s]) => ({
          text: s.libelle,
          value,
        })),
        valeurs: m => m.statut,
      },
    },
    {
      key: 'actions',
      title: 'Actions',
      redimensionnable: false,
      // Seul l'auteur sait ce qu'il a fait du message dans sa messagerie.
      render: (_, m) =>
        m.estLeMien &&
        (m.statut === 'EN_COURS' ? (
          <Space>
            <Button
              size="small"
              type="primary"
              aria-label={`Noter comme envoyé : ${m.objet}`}
              onClick={() => void declarer(m, 'ENVOYE')}
            >
              Envoyé
            </Button>
            <Button
              size="small"
              aria-label={`Noter comme annulé : ${m.objet}`}
              onClick={() => void declarer(m, 'ANNULE')}
            >
              Annulé
            </Button>
            <Button
              size="small"
              icon={<MailOutlined />}
              aria-label={`Rouvrir dans votre messagerie : ${m.objet}`}
              onClick={() => void rouvrir(m)}
            >
              Rouvrir
            </Button>
          </Space>
        ) : (
          <Button
            size="small"
            aria-label={`Remettre en cours : ${m.objet}`}
            onClick={() => void declarer(m, 'EN_COURS')}
          >
            Remettre en cours
          </Button>
        )),
    },
  ]

  return (
    <>
      <p style={{ maxWidth: '72ch' }}>
        Un message se prépare ici, puis part de la messagerie de son auteur.
        L’application n’envoie rien : l’état de chaque message est celui que son
        auteur a déclaré.
      </p>
      <Tableau<Message>
        id="messages"
        rowKey="id"
        loading={loading && data === undefined}
        dataSource={messages}
        pagination={{ pageSize: 50, hideOnSinglePage: true }}
        locale={{ emptyText: 'Aucun message n’a été préparé.' }}
        expandable={{
          expandedRowRender: m => (
            <div className="rt-message">
              {nomPerimetre(m) && (
                <Typography.Paragraph type="secondary">
                  Périmètre : {nomPerimetre(m)}
                </Typography.Paragraph>
              )}
              <Typography.Paragraph type="secondary">
                Destinataires :{' '}
                {m.destinataires
                  .map(d => d.personne.nom + (d.enCopie ? ' (Cc)' : ''))
                  .join(', ')}
              </Typography.Paragraph>
              <pre className="rt-message-corps">{m.corps}</pre>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => void copier(m.corps, 'Le texte est copié.')}
              >
                Copier le texte
              </Button>
            </div>
          ),
        }}
        colonnes={colonnes}
      />
    </>
  )
}
