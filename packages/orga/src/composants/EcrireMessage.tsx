import { CopyOutlined, DownOutlined, MailOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Col,
  Dropdown,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { useMemo, useRef, useState } from 'react'

import { useActivite } from '../lib/activite'
import { dateCourte, messageErreur } from '../lib/erreurs'
import {
  CHAMPS,
  CORPS_MAX,
  DESTINATAIRES_MAX,
  INSERABLES,
  LIBELLES,
  MODELES,
  MODELE_LIBRE,
  MODELE_PERIMETRE,
  OBJET_MAX,
  champParDefaut,
  composer,
  listerTaches,
  passagesACompleter,
  preparerLien,
  repartir,
  salutation,
  type ChampDestinataires,
  type Destinataire,
  type Informations,
  type StatutMessage,
} from '../lib/messages'
import {
  lienVers,
  lireMessagerie,
  messagerie,
  ouvreUnOnglet,
  ouvrirLaMessagerie,
  reserverOnglet,
} from '../lib/messagerie'
import { useOrganisation } from '../lib/organisation'
import { prenom } from '../lib/personnes'
import { EDITIONS, PERIMETRES } from '../lib/requetes'
import {
  CREER_MESSAGE,
  DEFINIR_STATUT_MESSAGE,
  INFORMATIONS_MESSAGE,
} from '../lib/requetes-messages'
import { useSession } from '../lib/session'
import { comparer } from '../lib/tableau'
import { estOuverte } from '../lib/taches'

import ChoixMessagerie from './ChoixMessagerie'
import CopierAdresses from './CopierAdresses'

// Fenêtre de rédaction d'un message (ADR 0020). L'admin choisit un modèle, complète
// le texte, puis ouvre sa propre messagerie : l'application n'envoie rien. Elle
// garde le message préparé et l'état que l'admin déclare ensuite.

/** Les personnes à qui écrire. */
export interface CibleMessage {
  destinataires: Destinataire[]
  /** Vrai quand toute la liste est choisie : le champ « Cci » est proposé d'office. */
  toutLeMonde: boolean
  /** Le périmètre concerné, quand le message part de sa carte. */
  perimetreId?: string
}

interface Props {
  /** Les personnes à qui écrire, ou null quand la fenêtre est fermée. */
  cible: CibleMessage | null
  fermer: () => void
  /**
   * Vrai pour un message écrit depuis l'annuaire, hors de toute activité : seuls
   * les admins de l'organisation le relisent.
   */
  annuaire?: boolean
  editionId?: string
  /**
   * Les contacts principaux de la période. Un message en copie cachée peut les
   * garder en copie visible.
   */
  contactsPrincipaux?: readonly string[]
}

const majuscule = (texte: string) =>
  texte.charAt(0).toLocaleUpperCase('fr') + texte.slice(1)

export default function EcrireMessage({ cible, fermer, ...reste }: Props) {
  // La dernière cible reste affichée pendant la fermeture de la fenêtre.
  const [gardee, setGardee] = useState(cible)
  if (cible !== null && cible !== gardee) setGardee(cible)
  return (
    <Modal
      open={cible !== null}
      title="Écrire un message"
      footer={null}
      onCancel={fermer}
      destroyOnHidden
      width={760}
    >
      {gardee && <Redaction cible={gardee} fermer={fermer} {...reste} />}
    </Modal>
  )
}

function Redaction({
  cible,
  fermer,
  annuaire = false,
  editionId,
  contactsPrincipaux = [],
}: Props & { cible: CibleMessage }) {
  const { message, modal } = App.useApp()
  const { activite, lien } = useActivite()
  const organisation = useOrganisation()
  const { moi } = useSession()

  // L'auteur reçoit déjà son message : il ne figure pas parmi les destinataires.
  const destinataires = useMemo(
    () => cible.destinataires.filter(d => d.id !== moi.id),
    [cible, moi.id]
  )
  const seul = destinataires.length === 1 ? destinataires[0] : undefined

  // Un message ouvert depuis la carte d'un périmètre part du modèle de périmètre.
  const [cleModele, setCleModele] = useState(
    cible.perimetreId === undefined ? MODELE_LIBRE : MODELE_PERIMETRE
  )
  const [perimetreId, setPerimetreId] = useState(cible.perimetreId)
  const [choixChamp, setChamp] = useState<ChampDestinataires>(() =>
    champParDefaut(destinataires.length, cible.toutLeMonde)
  )
  // Le champ « À » va avec une seule personne, et avec elle seulement : la liste
  // des destinataires peut changer pendant que la fenêtre est ouverte.
  const champ: ChampDestinataires = seul
    ? 'A'
    : choixChamp === 'A'
      ? champParDefaut(destinataires.length, cible.toutLeMonde)
      : choixChamp
  // Vrai quand l'application a pu copier le texte qu'un lien trop long ne porte pas.
  const [texteCopie, setTexteCopie] = useState(false)
  const [copieContacts, setCopieContacts] = useState(false)
  // La messagerie des préférences, que l'admin peut changer pour ce message.
  const [cleMessagerie, setCleMessagerie] = useState(lireMessagerie)
  // Null : l'objet et le texte suivent le modèle et les informations de
  // l'application. Une saisie de l'admin les fige.
  const [saisie, setSaisie] = useState<{ objet: string; corps: string } | null>(
    null
  )
  const [suivi, setSuivi] = useState<string | null>(null)
  const zone = useRef<TextAreaRef>(null)

  const { data: editions } = useQuery(EDITIONS)
  const { data: perimetres } = useQuery(PERIMETRES)
  const { data: lues } = useQuery(INFORMATIONS_MESSAGE, {
    variables: { editionId: editionId ?? '' },
    skip: editionId === undefined,
  })
  const [creer, creation] = useMutation(CREER_MESSAGE, {
    refetchQueries: ['Messages'],
  })
  const [definirStatut, declaration] = useMutation(DEFINIR_STATUT_MESSAGE, {
    refetchQueries: ['Messages'],
  })

  const edition = editions?.editions.find(e => e.id === editionId)
  const perimetre = perimetres?.perimetres.find(p => p.id === perimetreId)

  const informations = useMemo<Informations>(() => {
    const origine = window.location.origin
    const taches = [...(lues?.retroplanning ?? [])]
      .filter(t => perimetreId === undefined || t.perimetre.id === perimetreId)
      .sort((a, b) => comparer(a.echeance, b.echeance))
    const lister = (liste: typeof taches, aucune: string) =>
      lues === undefined
        ? null
        : listerTaches(
            liste.map(t => ({
              titre: t.titre,
              echeance: t.echeance ? dateCourte(t.echeance) : null,
              perimetre: perimetreId === undefined ? t.perimetre.nom : null,
            })),
            aucune
          )
    const aPourvoir = (lues?.postesAPourvoir ?? [])
      .filter(p => p.aPourvoir > 0)
      .map(p => p.perimetre)
    return {
      salutation: salutation(seul ? prenom(seul.nom) : null),
      signature: moi.nom,
      organisation: organisation.nom,
      activite: activite.nom,
      periode: edition?.nom ?? null,
      dates:
        edition === undefined
          ? null
          : edition.debut === edition.fin
            ? `le ${dateCourte(edition.debut)}`
            : `du ${dateCourte(edition.debut)} au ${dateCourte(edition.fin)}`,
      perimetre: perimetre?.nom ?? null,
      lienEspace: origine + lien('/'),
      lienPerimetre: perimetre
        ? origine + lien(`/perimetres/${perimetre.slug}`)
        : null,
      tachesEnCours: lister(
        taches.filter(estOuverte),
        'Aucune tâche n’est en cours.'
      ),
      tachesEnRetard: lister(
        taches.filter(t => t.enRetard),
        'Aucune tâche n’a dépassé son échéance.'
      ),
      postesAPourvoir:
        lues === undefined
          ? null
          : aPourvoir.length === 0
            ? 'Aucun périmètre n’est à pourvoir.'
            : activite.groupes
                .map(g => ({
                  titre: g.libellePluriel,
                  noms: aPourvoir.filter(p => p.groupe === g.cle),
                }))
                .filter(g => g.noms.length > 0)
                .map(g =>
                  [g.titre, ...g.noms.map(p => `- ${p.nom}`)].join('\n')
                )
                .join('\n\n'),
      invitationFormulaire: activite.formulaireOuvert
        ? `Vous pouvez déposer votre demande par ce formulaire :\n${origine}/rejoindre/${organisation.slug}/${activite.slug}`
        : '',
      contact: activite.contactRecrutement ?? null,
      pageEquipe: activite.pageEquipe ?? organisation.pageEquipe,
    }
  }, [
    activite,
    edition,
    lien,
    lues,
    moi.nom,
    organisation,
    perimetre,
    perimetreId,
    seul,
  ])

  const modele = MODELES.find(m => m.cle === cleModele) ?? MODELES[0]!
  const objet = saisie?.objet ?? composer(modele.objet, informations)
  const corps = saisie?.corps ?? composer(modele.corps, informations)

  const contacts = destinataires.filter(d => contactsPrincipaux.includes(d.id))
  const enCopie = new Set(
    champ === 'CCI' && copieContacts ? contacts.map(d => d.id) : []
  )
  const adresses = repartir(destinataires, champ, enCopie, moi.email)
  const { lien: lienMessagerie, omis } = preparerLien(
    { ...adresses, objet, corps },
    envoi => lienVers(cleMessagerie, envoi)
  )
  // Une cible dont l'éditeur ne documente pas les copies peut les ignorer.
  const copiesAVerifier =
    !messagerie(cleMessagerie).copiesEtablies &&
    omis !== 'adresses' &&
    adresses.cc.length + adresses.cci.length > 0
  const avisCopies = (suite: string) =>
    copiesAVerifier && (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        title="Vérifiez les champs « Cc » et « Cci » avant d’envoyer"
        description={`« ${messagerie(cleMessagerie).libelle} » ne reprend pas toujours ces champs. ${suite}`}
      />
    )
  const restes = passagesACompleter(`${objet}\n${corps}`)

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

  const choisirModele = (cle: string) => {
    if (saisie === null) {
      setCleModele(cle)
      return
    }
    modal.confirm({
      title: 'Remplacer le texte par le modèle ?',
      content: 'Le modèle remplace l’objet et le texte que vous avez modifiés.',
      okText: 'Remplacer',
      cancelText: 'Garder mon texte',
      onOk: () => {
        setCleModele(cle)
        setSaisie(null)
      },
    })
  }

  const inserer = (texte: string) => {
    const champTexte = zone.current?.resizableTextArea?.textArea
    const debut = champTexte?.selectionStart ?? corps.length
    const fin = champTexte?.selectionEnd ?? corps.length
    setSaisie({
      objet,
      corps: corps.slice(0, debut) + texte + corps.slice(fin),
    })
    // Le curseur se place après le texte inséré, une fois le champ mis à jour.
    requestAnimationFrame(() => {
      champTexte?.focus()
      champTexte?.setSelectionRange(debut + texte.length, debut + texte.length)
    })
  }

  const preparer = async () => {
    if (objet.trim() === '') {
      message.error('Saisissez l’objet du message.')
      return
    }
    if (corps.trim() === '') {
      message.error('Saisissez le texte du message.')
      return
    }
    // L'onglet d'une messagerie en ligne se réserve pendant le clic : ouvert après
    // l'enregistrement, le navigateur pourrait le bloquer.
    const onglet = reserverOnglet(lienMessagerie)
    try {
      const { data } = await creer({
        variables: {
          message: {
            activiteId: annuaire ? null : activite.id,
            editionId: annuaire ? null : (editionId ?? null),
            perimetreId: annuaire ? null : (perimetreId ?? null),
            modele: modele.cle,
            objet: objet.trim(),
            corps: corps.trim(),
            champ,
            destinataireIds: destinataires.map(d => d.id),
            enCopieIds: [...enCopie],
          },
        },
      })
      if (!data) {
        onglet?.close()
        return
      }
      if (omis !== 'rien') {
        // Le lien ne porte pas le texte : l'admin le colle dans sa messagerie. La
        // copie peut être refusée par le navigateur : la suite le dit alors.
        setTexteCopie(
          await navigator.clipboard.writeText(corps).then(
            () => true,
            () => false
          )
        )
      }
      ouvrirLaMessagerie(lienMessagerie, onglet)
      setSuivi(data.creerMessage.id)
    } catch (e) {
      onglet?.close()
      message.error(messageErreur(e))
    }
  }

  const declarer = async (statut: StatutMessage) => {
    if (suivi === null) return
    try {
      await definirStatut({ variables: { id: suivi, statut } })
      message.success(
        statut === 'ENVOYE'
          ? 'Le message est noté comme envoyé.'
          : 'Le message est noté comme annulé.'
      )
      fermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  const copies = (
    <CopierAdresses
      adresses={adresses}
      seul={champ === 'A'}
      cible={cleMessagerie}
    >
      <Button
        icon={<CopyOutlined />}
        onClick={() => void copier(objet, 'L’objet est copié.')}
      >
        Copier l’objet
      </Button>
      <Button
        icon={<CopyOutlined />}
        onClick={() => void copier(corps, 'Le texte est copié.')}
      >
        Copier le texte
      </Button>
    </CopierAdresses>
  )

  if (destinataires.length === 0) {
    return (
      <Alert
        type="info"
        showIcon
        title="Aucune personne à qui écrire"
        description="La sélection ne contient que votre propre compte, ou aucune personne."
      />
    )
  }

  if (suivi !== null) {
    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="success"
          showIcon
          title="Le message est prêt dans votre messagerie"
          description="L’application n’envoie rien : vous relisez le message dans votre messagerie, puis vous l’envoyez."
        />
        {omis === 'texte' && (
          <Alert
            type="warning"
            showIcon
            title="Collez le texte dans le message"
            description={
              texteCopie
                ? 'Le texte est trop long pour le lien vers la messagerie. L’application l’a copié : collez-le dans le corps du message.'
                : 'Le texte est trop long pour le lien vers la messagerie, et la copie automatique a échoué. Copiez le texte avec le bouton ci-dessous, puis collez-le dans le corps du message.'
            }
          />
        )}
        {omis === 'adresses' && (
          <Alert
            type="warning"
            showIcon
            title="Collez les adresses et le texte dans le message"
            description="Les destinataires sont trop nombreux pour le lien vers la messagerie. La messagerie s’ouvre avec l’objet seulement. Copiez les adresses et le texte avec les boutons ci-dessous."
          />
        )}
        {avisCopies(
          'S’ils sont vides dans votre message, copiez les adresses avec les boutons ci-dessous.'
        )}
        <div>
          <Typography.Paragraph type="secondary">
            Si votre messagerie ne s’est pas ouverte, rouvrez-la, ou copiez
            chaque partie du message.
          </Typography.Paragraph>
          <Space orientation="vertical" size={8}>
            <Button
              icon={<MailOutlined />}
              href={lienMessagerie}
              {...(ouvreUnOnglet(lienMessagerie)
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              Rouvrir la messagerie
            </Button>
            {copies}
          </Space>
        </div>
        <div>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            Avez-vous envoyé ce message ?
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            Votre réponse met à jour l’onglet « Messages ». Sans réponse, le
            message y reste « En cours » et vous répondez plus tard.
          </Typography.Paragraph>
          <Space wrap>
            <Button
              type="primary"
              loading={declaration.loading}
              onClick={() => void declarer('ENVOYE')}
            >
              Le message est envoyé
            </Button>
            <Button
              disabled={declaration.loading}
              onClick={() => void declarer('ANNULE')}
            >
              Je n’envoie pas ce message
            </Button>
            <Button type="text" onClick={fermer}>
              Répondre plus tard
            </Button>
          </Space>
        </div>
      </Space>
    )
  }

  return (
    <Form layout="vertical" component="div" requiredMark={false}>
      <Form.Item
        label={
          seul ? 'Destinataire' : `Destinataires (${destinataires.length})`
        }
      >
        <div className="rt-destinataires">
          {destinataires.map(d => (
            <Tag key={d.id} style={{ marginInlineEnd: 0 }}>
              {d.nom}
              {enCopie.has(d.id) && ' (Cc)'}
            </Tag>
          ))}
        </div>
      </Form.Item>
      {destinataires.length > DESTINATAIRES_MAX && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={`Un message compte ${DESTINATAIRES_MAX} destinataires au plus. Réduisez la sélection.`}
        />
      )}

      {!seul && (
        <Form.Item
          label="Champ des destinataires"
          extra={
            champ === 'CCI'
              ? 'Le message vous est adressé. Chaque destinataire le reçoit sans voir l’adresse des autres.'
              : undefined
          }
        >
          <Space orientation="vertical" size={8} style={{ width: '100%' }}>
            <Segmented<ChampDestinataires>
              value={champ}
              onChange={setChamp}
              options={[
                { value: 'CC', label: `${CHAMPS.CC} (adresses visibles)` },
                { value: 'CCI', label: `${CHAMPS.CCI} (adresses cachées)` },
              ]}
            />
            {champ === 'CC' && (
              <Alert
                type="warning"
                showIcon
                title="Chaque destinataire voit l’adresse des autres"
                description="Le champ Cc affiche toutes les adresses. Nous vous conseillons le champ Cci, sauf pour des personnes qui travaillent déjà ensemble."
              />
            )}
            {champ === 'CCI' && contacts.length > 0 && (
              <Checkbox
                checked={copieContacts}
                onChange={e => setCopieContacts(e.target.checked)}
              >
                Garder en copie visible (Cc){' '}
                {contacts.length === 1
                  ? 'le contact principal'
                  : 'les contacts principaux'}{' '}
                : {contacts.map(d => d.nom).join(', ')}
              </Checkbox>
            )}
          </Space>
        </Form.Item>
      )}

      <Row gutter={16}>
        <Col xs={24} sm={14}>
          <Form.Item label="Modèle" extra={modele.description}>
            <Select
              aria-label="Modèle"
              value={modele.cle}
              onChange={choisirModele}
              options={MODELES.map(m => ({ value: m.cle, label: m.libelle }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={10}>
          <Form.Item
            label="Périmètre"
            extra="Le périmètre choisi alimente son nom, son adresse et ses tâches."
          >
            <Select
              aria-label="Périmètre"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tous les périmètres"
              value={perimetreId}
              onChange={(id?: string) => setPerimetreId(id)}
              options={(perimetres?.perimetres ?? []).map(p => ({
                value: p.id,
                label: p.nom,
              }))}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Objet">
        <Input
          aria-label="Objet"
          maxLength={OBJET_MAX}
          value={objet}
          onChange={e => setSaisie({ objet: e.target.value, corps })}
        />
      </Form.Item>
      <Form.Item
        label={
          <Space size={16}>
            <span>Texte</span>
            <Dropdown
              trigger={['click']}
              menu={{
                items: INSERABLES.map(cle => ({
                  key: cle,
                  label: majuscule(LIBELLES[cle]),
                  disabled: !informations[cle],
                })),
                onClick: ({ key }) =>
                  inserer(informations[key as keyof Informations] ?? ''),
              }}
            >
              <Button size="small">
                Insérer une information <DownOutlined />
              </Button>
            </Dropdown>
          </Space>
        }
        extra={
          seul
            ? undefined
            : 'Tous les destinataires reçoivent le même texte : il ne porte aucune information propre à une personne.'
        }
      >
        <Input.TextArea
          ref={zone}
          aria-label="Texte"
          rows={14}
          maxLength={CORPS_MAX}
          value={corps}
          onChange={e => setSaisie({ objet, corps: e.target.value })}
        />
      </Form.Item>

      {restes.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Le message contient des passages à compléter"
          description={restes.join(' · ')}
        />
      )}
      {omis !== 'rien' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={
            omis === 'texte'
              ? 'Le texte est trop long pour s’ouvrir seul dans la messagerie'
              : 'Les destinataires sont trop nombreux pour s’ouvrir seuls dans la messagerie'
          }
          description={
            omis === 'texte'
              ? 'La messagerie s’ouvre avec les destinataires et l’objet. L’application copie le texte : vous le collez dans le message.'
              : 'La messagerie s’ouvre avec l’objet. Vous copiez ensuite les adresses et le texte depuis cette fenêtre.'
          }
        />
      )}

      {avisCopies(
        'Après l’ouverture, cette fenêtre propose de copier les adresses.'
      )}

      <Form.Item
        label="Messagerie"
        extra="Vos préférences fixent la messagerie proposée. Ce choix ne vaut que pour ce message."
      >
        <ChoixMessagerie
          valeur={cleMessagerie}
          choisir={setCleMessagerie}
          style={{ width: '100%', maxWidth: 420 }}
        />
      </Form.Item>

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={fermer}>Annuler</Button>
        <Button
          type="primary"
          icon={<MailOutlined />}
          loading={creation.loading}
          disabled={destinataires.length > DESTINATAIRES_MAX}
          onClick={() => void preparer()}
        >
          Ouvrir dans votre messagerie
        </Button>
      </Space>
    </Form>
  )
}
