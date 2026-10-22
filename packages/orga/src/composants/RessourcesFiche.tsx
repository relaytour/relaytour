import {
  DeleteOutlined,
  ExclamationCircleOutlined,
  FolderOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  App,
  Button,
  Empty,
  Modal,
  Popconfirm,
  Popover,
  Skeleton,
  Space,
  Tag,
} from 'antd'
import { useState } from 'react'

import type { RessourcesFicheQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { messageErreur } from '../lib/erreurs'
import {
  DELIER_RESSOURCE,
  DOSSIERS_LIES,
  ICONES_APERCU,
  LIER_RESSOURCE,
  MODIFIER_DOSSIER_LIE,
  OUVRIR_DOCUMENT,
  RESSOURCES_FICHE,
} from '../lib/espace-fichiers'
import { MOI } from '../lib/requetes'
import { useMentions } from '../lib/useMentions'
import ExplorateurDossier, { type DossierAffiche } from './ExplorateurDossier'
import Liseuse, { type DocumentOuvert } from './Liseuse'
import { Panneau } from './Panneau'

type Ressource = NonNullable<
  RessourcesFicheQuery['fiche']
>['ressources'][number]

/**
 * Choix d'un document à lier : d'abord un dossier lié qui sert le périmètre de la
 * fiche ou toute l'activité, puis un fichier ou un dossier dans ce dossier.
 */
function LierRessource({
  ficheId,
  perimetreId,
  ouvert,
  onFermer,
}: {
  ficheId: string
  perimetreId: string | null
  ouvert: boolean
  onFermer: () => void
}) {
  const { activite, libelleGroupe } = useActivite()
  const { message } = App.useApp()
  const [dossier, setDossier] = useState<DossierAffiche | null>(null)
  const dossiers = useQuery(DOSSIERS_LIES, {
    variables: { activiteId: activite.id, perimetreId },
    skip: !ouvert,
  })
  const [lier, { loading: enCours }] = useMutation(LIER_RESSOURCE, {
    refetchQueries: ['RessourcesFiche'],
  })

  // Le serveur ne rend que les dossiers qui servent le périmètre de la fiche. Une
  // fiche commune n'admet que les dossiers de toute l'activité.
  const compatibles = (dossiers.data?.dossiersLies ?? []).filter(
    d => perimetreId !== null || d.touteActivite
  )

  const fermer = () => {
    setDossier(null)
    onFermer()
  }

  const choisir = async (chemin: string[], nom: string) => {
    if (dossier === null || enCours) return
    try {
      await lier({
        variables: { ficheId, dossierLieId: dossier.id, chemin },
      })
      message.success(`« ${nom} » est lié à la fiche.`)
      fermer()
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  return (
    <Modal
      open={ouvert}
      onCancel={fermer}
      title="Lier un document"
      footer={null}
      width={640}
      destroyOnHidden
    >
      {dossier === null ? (
        dossiers.loading && !dossiers.data ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : compatibles.length === 0 ? (
          <Empty description="Aucun dossier du fournisseur cloud ne sert ce périmètre ni toute l’activité." />
        ) : (
          <>
            <p className="rt-texte-secondaire">
              Choisissez un dossier lié. Les lecteurs de la fiche lisent ses
              documents.
            </p>
            <ul className="rt-explorateur">
              {compatibles.map(d => (
                <li key={d.id}>
                  <button type="button" onClick={() => setDossier(d)}>
                    <FolderOutlined
                      aria-hidden
                      className="rt-explorateur-icone"
                    />
                    <span className="rt-explorateur-nom">
                      {d.nom}
                      <span className="rt-explorateur-detail">
                        {d.touteActivite
                          ? 'Toute l’activité'
                          : [
                              ...d.groupes.map(g => libelleGroupe(g, true)),
                              ...d.perimetres.map(p => p.nom),
                            ].join(', ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      ) : (
        <>
          <p className="rt-texte-secondaire">
            Choisissez un fichier, ou liez un dossier entier.
          </p>
          <ExplorateurDossier
            dossier={dossier}
            sansCadre
            onRetour={() => setDossier(null)}
            onChoisir={(chemin, nom) => void choisir(chemin, nom)}
          />
        </>
      )}
    </Modal>
  )
}

/** « Basket », « Basket et Accueil », « Basket, Accueil et Voile ». */
function enumerer(noms: string[]): string {
  if (noms.length <= 1) return noms.join('')
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
}

/**
 * L'accès à un document lié d'une fiche partagée (ADR 0043). La personne qui
 * rédige lit les périmètres qui n'ouvriront pas le document. Un admin de
 * l'organisation étend le dossier lié aux périmètres et aux groupes de la fiche,
 * ouvre ce seul document à ses lecteurs, ou le referme.
 */
function AccesDocument({
  ressource: r,
  groupesDeLaFiche,
  admin,
}: {
  ressource: Ressource
  groupesDeLaFiche: string[]
  admin: boolean
}) {
  const { message } = App.useApp()
  const { libelleGroupe } = useActivite()
  const mentions = useMentions()
  const [modifier, { loading: extension }] = useMutation(MODIFIER_DOSSIER_LIE, {
    refetchQueries: ['RessourcesFiche', 'DossiersLies'],
  })
  const [ouvrir, { loading: ouverture }] = useMutation(OUVRIR_DOCUMENT, {
    refetchQueries: ['RessourcesFiche'],
  })
  const sans = r.perimetresSansAcces
  if (sans.length === 0 && !r.ouverteAuxLecteurs) return null

  const groupeDe = new Map(
    [...mentions.perimetres.values()].map(p => [p.id, p.groupe])
  )
  // Les groupes de la fiche restent des groupes ; les autres périmètres
  // s'ajoutent un par un.
  const groupes = [...new Set([...r.dossierLie.groupes, ...groupesDeLaFiche])]
  const perimetres = [
    ...new Set([
      ...r.dossierLie.perimetres.map(p => p.id),
      ...sans
        .filter(p => !groupesDeLaFiche.includes(groupeDe.get(p.id) ?? ''))
        .map(p => p.id),
    ]),
  ]
  const ajouts = enumerer([
    ...groupesDeLaFiche
      .filter(g => !r.dossierLie.groupes.includes(g))
      .map(g => libelleGroupe(g, true)),
    ...sans
      .filter(p => !groupesDeLaFiche.includes(groupeDe.get(p.id) ?? ''))
      .map(p => p.nom),
  ])

  const etendre = () =>
    modifier({
      variables: {
        id: r.dossierLie.id,
        lecteurs: { touteActivite: false, perimetreIds: perimetres, groupes },
        nom: null,
      },
    })
      .then(() =>
        message.success(`« ${r.dossierLie.nom} » est aussi lu par ${ajouts}.`)
      )
      .catch((e: unknown) => message.error(messageErreur(e)))
  const basculer = (ouvert: boolean) =>
    ouvrir({ variables: { id: r.id, ouvert } })
      .then(() =>
        message.success(
          ouvert
            ? 'Le document s’ouvre pour tous les lecteurs de la fiche.'
            : 'Le document est réservé aux lecteurs de son dossier lié.'
        )
      )
      .catch((e: unknown) => message.error(messageErreur(e)))

  const contenu = r.ouverteAuxLecteurs ? (
    <div className="rt-acces-document">
      <p>
        Un admin de l’organisation a ouvert ce document à toutes les personnes
        qui lisent la fiche. Le reste du dossier lié reste réservé à ses
        lecteurs.
      </p>
      {admin && (
        <Button
          size="small"
          loading={ouverture}
          onClick={() => void basculer(false)}
        >
          Réserver de nouveau
        </Button>
      )}
    </div>
  ) : (
    <div className="rt-acces-document">
      <p>
        Les lecteurs de {enumerer(sans.map(p => p.nom))} n’ouvriront pas ce
        document : le dossier lié « {r.dossierLie.nom} » ne sert pas ces
        périmètres.
      </p>
      {admin ? (
        <Space wrap>
          <Popconfirm
            title={`Étendre « ${r.dossierLie.nom} » ?`}
            description={`Les lecteurs de ${ajouts} liront tout le dossier, et pas seulement ce document.`}
            okText="Étendre"
            cancelText="Annuler"
            onConfirm={() => void etendre()}
          >
            <Button size="small" loading={extension}>
              Étendre le dossier lié
            </Button>
          </Popconfirm>
          {/* Le dossier lié entier n'est pas un document : ses lecteurs s'étendent. */}
          {r.chemin.length > 0 && (
            <Button
              size="small"
              loading={ouverture}
              onClick={() => void basculer(true)}
            >
              Ouvrir ce document aux lecteurs de la fiche
            </Button>
          )}
        </Space>
      ) : (
        <p className="rt-texte-secondaire">
          Un admin de l’organisation peut étendre le dossier lié, ou ouvrir ce
          seul document aux lecteurs de la fiche.
        </p>
      )}
    </div>
  )
  return (
    <Popover
      trigger="click"
      title={r.ouverteAuxLecteurs ? 'Document ouvert' : 'Document réservé'}
      content={contenu}
    >
      <Button
        type="text"
        size="small"
        icon={
          r.ouverteAuxLecteurs ? (
            <LinkOutlined />
          ) : (
            <ExclamationCircleOutlined style={{ color: 'var(--rt-alerte)' }} />
          )
        }
        aria-label={
          r.ouverteAuxLecteurs
            ? `${r.nom} : ouvert aux lecteurs de la fiche`
            : `${r.nom} : réservé, fermé pour ${sans.length > 1 ? `${sans.length} périmètres` : 'un périmètre'}`
        }
      />
    </Popover>
  )
}

function NomRessource({
  ressource: r,
  mention,
}: {
  ressource: Ressource
  mention?: string
}) {
  return (
    <span className="rt-explorateur-nom">
      {r.nom}
      <span className="rt-explorateur-detail">
        {r.chemin.length === 0
          ? 'Dossier lié'
          : [r.dossierLie.nom, ...r.chemin.slice(0, -1)].join(' / ')}
      </span>
      {/* Sous le nom : une étiquette à droite écraserait le nom sur un téléphone. */}
      {mention !== undefined && (
        <Tag className="rt-explorateur-mention">{mention}</Tag>
      )}
    </span>
  )
}

/**
 * Les documents du fournisseur cloud liés à une fiche (ADR 0038, 0043), sous son
 * texte. Un fichier s'ouvre dans la liseuse, un dossier dans l'explorateur. Un
 * document dont la personne ne lit pas le dossier lié reste dans la liste, sans
 * s'ouvrir, sauf s'il est ouvert aux lecteurs de la fiche. Une personne qui rédige
 * la fiche lie et retire les documents, et apprend lesquels restent réservés.
 */
export default function RessourcesFiche({
  slug,
  ficheId,
  perimetreId,
  peutModifier,
}: {
  slug: string
  ficheId: string
  perimetreId: string | null
  peutModifier: boolean
}) {
  const { message } = App.useApp()
  const { activite } = useActivite()
  const admin = useQuery(MOI).data?.moi?.estAdmin === true
  const { data, loading } = useQuery(RESSOURCES_FICHE, {
    variables: { slug },
  })
  // Sans dossier lié utilisable, une personne qui rédige ne voit pas le bloc :
  // l'organisation n'utilise peut-être pas d'espace de fichiers.
  const dossiers = useQuery(DOSSIERS_LIES, {
    variables: { activiteId: activite.id, perimetreId },
    skip: !peutModifier,
  })
  const [delier] = useMutation(DELIER_RESSOURCE, {
    refetchQueries: ['RessourcesFiche'],
  })
  const [choix, setChoix] = useState(false)
  const [document, setDocument] = useState<DocumentOuvert | null>(null)
  const [dossierOuvert, setDossierOuvert] = useState<Ressource | null>(null)

  const ressources = data?.fiche?.ressources ?? []
  const lienPossible = (dossiers.data?.dossiersLies ?? []).some(
    d => perimetreId !== null || d.touteActivite
  )
  if (ressources.length === 0 && !(peutModifier && lienPossible)) return null

  const ouvrir = (r: Ressource) => {
    if (r.type === 'DOSSIER') {
      setDossierOuvert(r)
      return
    }
    setDocument({
      dossierId: r.dossierLie.id,
      ressourceId: r.ouverteAuxLecteurs ? r.id : null,
      chemin: r.chemin,
      nom: r.nom,
      apercu: r.apercu,
      lienWeb: r.lienWeb ?? null,
      fournisseur: r.dossierLie.fournisseur,
    })
  }

  return (
    <Panneau
      titre="Documents liés"
      extra={
        peutModifier && (
          <Button
            size="small"
            icon={<LinkOutlined />}
            onClick={() => setChoix(true)}
          >
            Lier un document
          </Button>
        )
      }
    >
      {loading && !data ? (
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      ) : ressources.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Aucun document du fournisseur cloud n’est lié à cette fiche."
        />
      ) : (
        <ul className="rt-explorateur">
          {ressources.map(r => {
            const Icone =
              r.type === 'DOSSIER' ? FolderOutlined : ICONES_APERCU[r.apercu]
            return (
              <li key={r.id} className="rt-explorateur-element">
                {r.ouvrable ? (
                  <button type="button" onClick={() => ouvrir(r)}>
                    <Icone aria-hidden className="rt-explorateur-icone" />
                    <NomRessource
                      ressource={r}
                      mention={
                        r.ouverteAuxLecteurs && (peutModifier || admin)
                          ? 'Ouvert aux lecteurs de la fiche'
                          : undefined
                      }
                    />
                    {r.existe === false && (
                      <Tag color="warning">Introuvable</Tag>
                    )}
                    {!r.dossierLie.disponible && (
                      <Tag color="warning">Indisponible</Tag>
                    )}
                  </button>
                ) : (
                  // Une ressource d'un autre périmètre, lue dans une fiche
                  // connexe (ADR 0039) : la personne ne lit pas son dossier lié.
                  <div className="rt-explorateur-ligne">
                    <Icone aria-hidden className="rt-explorateur-icone" />
                    <NomRessource
                      ressource={r}
                      mention="Réservée au périmètre d’origine"
                    />
                  </div>
                )}
                {(peutModifier || admin) && (
                  <AccesDocument
                    ressource={r}
                    groupesDeLaFiche={data?.fiche?.concerneGroupes ?? []}
                    admin={admin}
                  />
                )}
                {peutModifier && (
                  <Popconfirm
                    title="Retirer ce document lié ?"
                    description="Le document reste chez le fournisseur cloud. La fiche ne le cite plus."
                    okText="Retirer"
                    cancelText="Annuler"
                    onConfirm={() =>
                      delier({ variables: { id: r.id } }).catch((e: unknown) =>
                        message.error(messageErreur(e))
                      )
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      aria-label={`Retirer ${r.nom}`}
                    />
                  </Popconfirm>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Liseuse document={document} onFermer={() => setDocument(null)} />
      <Modal
        open={dossierOuvert !== null}
        onCancel={() => setDossierOuvert(null)}
        title={dossierOuvert?.nom}
        footer={null}
        width={720}
        destroyOnHidden
      >
        {dossierOuvert && (
          <ExplorateurDossier
            dossier={dossierOuvert.dossierLie}
            cheminInitial={dossierOuvert.chemin}
            ressourceId={
              dossierOuvert.ouverteAuxLecteurs ? dossierOuvert.id : null
            }
            sansCadre
          />
        )}
      </Modal>
      {peutModifier && (
        <LierRessource
          ficheId={ficheId}
          perimetreId={perimetreId}
          ouvert={choix}
          onFermer={() => setChoix(false)}
        />
      )}
    </Panneau>
  )
}
