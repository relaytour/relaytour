import {
  BookOutlined,
  CalendarOutlined,
  CheckOutlined,
  EditOutlined,
  MessageOutlined,
  MoreOutlined,
  ShareAltOutlined,
  UndoOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { useMutation } from '@apollo/client/react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { App, Button, Dropdown, Form, Modal, Select, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'

import type { TacheChampsFragment } from '../gql/graphql'
import { useActivite } from '../lib/activite'
import { useCommentairesDeLaPeriode } from '../lib/commentaires'
import type { ResumeDeclinaisons } from '../lib/declinaisons'
import { dateCourte } from '../lib/erreurs'
import {
  ASSIGNER_TACHE,
  CHANGER_STATUT,
  estOuverte,
  etatEcheance,
  useActionTache,
  VUES_TACHES,
} from '../lib/taches'

import type { PerimetreCible } from './ChoixPerimetresCibles'
import DeclinaisonsTache from './DeclinaisonsTache'
import DeclinerTache from './DeclinerTache'
import EtiquettePerimetre from './EtiquettePerimetre'
import FilTache from './FilTache'
import { PastilleEtat, PastilleStatut } from './Etat'
import { PersonneNommee } from './Personne'

export interface Referent {
  id: string
  nom: string
}

/**
 * Une tâche et ses actions : prise en charge, statut, assignation d'une autre
 * personne du périmètre (ADR 0028), commentaires (ADR 0029), modification. Le rail porte la couleur du périmètre. `teinte` met en avant
 * une tâche à prendre.
 */
export default function TacheCarte({
  tache,
  moiId,
  peutModifier,
  referents,
  estAdmin = false,
  afficherPerimetre = false,
  teinte = false,
  enEvidence = false,
  filOuvert = false,
  onModifier,
  onPlanifierReunion,
  perimetresCibles,
  editionId,
}: {
  // La page d'un périmètre lit en plus ce qui relie les tâches partagées : le
  // périmètre qui demande une déclinaison, et le résumé des déclinaisons.
  tache: TacheChampsFragment & {
    origine?: {
      id: string
      perimetre: { slug: string; nom: string; couleur?: string | null }
    } | null
    resumeDeclinaisons?: ResumeDeclinaisons | null
  }
  moiId: string
  peutModifier: boolean
  referents: Referent[]
  estAdmin?: boolean
  afficherPerimetre?: boolean
  teinte?: boolean
  /** La tâche visée par une notification : la carte se signale et se place à l'écran. */
  enEvidence?: boolean
  /** Vrai quand une notification de commentaire vise la tâche : son fil s'ouvre. */
  filOuvert?: boolean
  onModifier?: (tache: TacheChampsFragment) => void
  /** Ouvre la fenêtre d'une réunion liée à la tâche (ADR 0037). */
  onPlanifierReunion?: (tache: TacheChampsFragment) => void
  /**
   * Les autres périmètres de l'activité où décliner la tâche (ADR 0026). Sans
   * cette liste, la carte ne propose pas de la décliner.
   */
  perimetresCibles?: PerimetreCible[]
  /**
   * La période affichée : les liens vers une autre tâche la gardent, et le nombre
   * de commentaires s'y lit. Sans elle, la carte ne propose pas le fil.
   */
  editionId?: string
}) {
  const racine = useRef<HTMLElement>(null)
  useEffect(() => {
    if (enEvidence) racine.current?.scrollIntoView({ block: 'center' })
  }, [enEvidence])
  const { t } = useLingui()
  const executer = useActionTache()
  const { message, modal } = App.useApp()
  const { lien } = useActivite()
  const [assigner, assignation] = useMutation(ASSIGNER_TACHE, {
    refetchQueries: VUES_TACHES,
  })
  const [changerStatut, changement] = useMutation(CHANGER_STATUT, {
    refetchQueries: VUES_TACHES,
  })
  const [cloture, setCloture] = useState(false)
  const [realiseeParId, setRealiseeParId] = useState<string | null>(null)
  const [choixAssignation, setChoixAssignation] = useState(false)
  const [aDecliner, setADecliner] = useState(false)
  // Le fil s'ouvre quand la personne lit le périmètre de la tâche (ADR 0029).
  const commentaires = useCommentairesDeLaPeriode(editionId)
  const filLisible = commentaires.lus.has(tache.perimetre.id)
  const nombreCommentaires = commentaires.nombres.get(tache.id) ?? 0
  const [fil, setFil] = useState(filOuvert)
  // La page reste montée quand une notification change seulement l'adresse : le
  // fil s'ouvre aussi quand `filOuvert` devient vrai après le montage.
  const [filDemande, setFilDemande] = useState(filOuvert)
  if (filOuvert !== filDemande) {
    setFilDemande(filOuvert)
    if (filOuvert) setFil(true)
  }
  const resume = tache.resumeDeclinaisons
  const titreTache = tache.titre
  // Une déclinaison ne se décline pas : seule une tâche du périmètre se partage.
  const declinable =
    peutModifier &&
    !tache.origine &&
    perimetresCibles !== undefined &&
    perimetresCibles.length > 0

  const assignee = tache.assignes.some(p => p.id === moiId)
  const ouverte = estOuverte(tache)
  const enAction = assignation.loading || changement.loading
  // Le serveur refuse d'assigner une personne non affectée au périmètre pour l'édition.
  const affectee = referents.some(r => r.id === moiId)
  // Toute personne qui écrit dans le périmètre assigne et retire les autres
  // personnes depuis la carte (ADR 0028).
  const gererAssignes = peutModifier && ouverte
  // La personne connectée s'assigne par le bouton « Je m'en occupe ».
  const assignables = referents.filter(
    r => r.id !== moiId && !tache.assignes.some(p => p.id === r.id)
  )
  const echeance = etatEcheance(tache)
  const nomCloture = tache.clotureePar?.nom
  const nomRealisation = tache.realiseePar?.nom
  const dateEcheance = tache.echeance ? dateCourte(tache.echeance) : ''
  // Le menu « Autres actions » ne s'affiche que s'il propose au moins une entrée :
  // une tâche faite ou abandonnée, hors page du périmètre, n'en a aucune.
  const autresActions = [
    ...(onModifier
      ? [{ key: 'modifier', icon: <EditOutlined />, label: t`Modifier` }]
      : []),
    ...(tache.statut === 'A_FAIRE'
      ? [{ key: 'EN_COURS', label: t`Marquer en cours` }]
      : []),
    ...(tache.statut === 'EN_COURS'
      ? [{ key: 'A_FAIRE', label: t`Remettre à faire` }]
      : []),
    ...(onPlanifierReunion && peutModifier && ouverte
      ? [
          {
            key: 'reunion',
            icon: <CalendarOutlined />,
            label: t`Planifier une réunion`,
          },
        ]
      : []),
    ...(declinable
      ? [
          {
            key: 'decliner',
            icon: <ShareAltOutlined />,
            label: t`Décliner dans d’autres périmètres`,
          },
        ]
      : []),
    ...(ouverte
      ? [{ key: 'ABANDONNEE', label: t`Abandonner`, danger: true }]
      : []),
  ]

  const assignerPersonne = (
    personneId: string,
    assigne: boolean,
    succes?: string
  ) =>
    executer(
      () => assigner({ variables: { id: tache.id, assigne, personneId } }),
      succes
    )

  // Assigner une autre personne ne demande aucune confirmation : le message de
  // succès la nomme et propose d'annuler le geste.
  const assignerAutre = async (personne: Referent) => {
    if (!(await assignerPersonne(personne.id, true))) return
    const cle = `assignation-${tache.id}-${personne.id}`
    const nomPersonne = personne.nom
    message.open({
      key: cle,
      type: 'success',
      // Le message reste dix secondes. Passé ce délai, la croix à côté du nom
      // retire encore la personne.
      duration: 10,
      content: (
        <>
          <Trans>Tâche assignée à {nomPersonne}.</Trans>
          <Button
            type="link"
            size="small"
            onClick={() => {
              message.destroy(cle)
              void assignerPersonne(
                personne.id,
                false,
                t`L’assignation est annulée.`
              )
            }}
          >
            <Trans>Annuler</Trans>
          </Button>
        </>
      ),
    })
  }

  // Retirer une autre personne demande une confirmation, se retirer soi-même non.
  const retirerPersonne = async (personne: { id: string; nom: string }) => {
    if (personne.id === moiId) {
      await assignerPersonne(moiId, false, t`Vous êtes retiré·e de la tâche.`)
      return
    }
    const nomPersonne = personne.nom
    const confirme = await modal.confirm({
      title: t`Retirer ${nomPersonne} de cette tâche ?`,
      content: t`« ${titreTache} ». ${nomPersonne} en sera prévenu·e.`,
      okText: t`Retirer`,
      cancelText: t`Annuler`,
    })
    if (confirme) {
      await assignerPersonne(
        personne.id,
        false,
        t`${nomPersonne} est retiré·e de la tâche.`
      )
    }
  }

  const statut = (
    nouveau: TacheChampsFragment['statut'],
    succes: string,
    realisee?: string | null
  ) =>
    executer(
      reprise =>
        changerStatut({
          variables: {
            id: tache.id,
            statut: nouveau,
            realiseeParId: realisee ?? null,
            confirmer: reprise.confirmer,
            // Le statut affiché : le serveur refuse de changer un statut qu'une
            // autre personne a modifié entre-temps.
            statutAttendu: reprise.statutAttendu ?? tache.statut,
          },
        }),
      succes
    )

  const terminer = async () => {
    if (await statut('FAITE', t`Tâche marquée comme faite.`, realiseeParId)) {
      setCloture(false)
      setRealiseeParId(null)
    }
  }

  return (
    <article
      ref={racine}
      className={`${teinte ? 'rt-verre-teinte' : 'rt-verre'} rt-carte-tache${tache.statut === 'ABANDONNEE' ? ' rt-abandonnee' : ''}${enEvidence ? ' rt-en-evidence' : ''}`}
    >
      <span
        className="rt-rail"
        style={{ background: tache.perimetre.couleur ?? 'var(--rt-primaire)' }}
        aria-hidden="true"
      />
      <div className="rt-carte-tache-corps">
        <div className="rt-carte-tache-titre">
          <Typography.Text
            delete={tache.statut === 'ABANDONNEE'}
            style={{ fontSize: 16, fontWeight: 600 }}
          >
            {tache.titre}
          </Typography.Text>
          {afficherPerimetre && (
            <EtiquettePerimetre
              nom={tache.perimetre.nom}
              couleur={tache.perimetre.couleur}
              lien={lien(`/perimetres/${tache.perimetre.slug}`)}
            />
          )}
        </div>
        {tache.description && (
          <Typography.Paragraph
            className="rt-description-tache"
            ellipsis={{
              rows: 2,
              expandable: 'collapsible',
              symbol: e => (e ? t`Réduire` : t`Lire la suite`),
            }}
          >
            {tache.description}
          </Typography.Paragraph>
        )}
        {tache.origine && (
          <p className="rt-demandee-par">
            <Trans>Demandée par</Trans>
            <EtiquettePerimetre
              nom={tache.origine.perimetre.nom}
              couleur={tache.origine.perimetre.couleur}
              point
              lien={lien(
                `/perimetres/${tache.origine.perimetre.slug}?${editionId ? `edition=${editionId}&` : ''}tache=${tache.origine.id}`
              )}
            />
          </p>
        )}
        <div className="rt-meta">
          <PastilleStatut statut={tache.statut} />
          {tache.fiche && (
            <PastilleEtat
              variante="alerte"
              icone={<BookOutlined aria-hidden />}
              lien={lien(`/fiches/${tache.fiche.slug}`)}
            >
              {tache.fiche.titre}
            </PastilleEtat>
          )}
          {tache.echeance && (
            <span
              className={`rt-date${echeance === 'retard' ? ' rt-date-retard' : echeance === 'proche' ? ' rt-date-proche' : ''}`}
            >
              {echeance === 'retard'
                ? t`En retard : ${dateEcheance}`
                : t`Échéance ${dateEcheance}`}
            </span>
          )}
          {tache.assignes.length === 0 && ouverte ? (
            <PastilleEtat variante="alerte" sansPoint>
              <Trans>Personne n’est assigné·e</Trans>
            </PastilleEtat>
          ) : (
            tache.assignes.map(p => (
              <PersonneNommee
                key={p.id}
                nom={p.id === moiId ? t`Vous` : p.nom}
                initialesDe={p.nom}
                desactive={enAction}
                retirer={
                  gererAssignes ? () => void retirerPersonne(p) : undefined
                }
              />
            ))
          )}
          {filLisible && (
            <button
              type="button"
              className="rt-ouvrir-fil"
              onClick={() => setFil(true)}
            >
              <MessageOutlined aria-hidden />
              {nombreCommentaires > 0
                ? t`${plural(nombreCommentaires, { one: '# commentaire', other: '# commentaires' })}`
                : peutModifier
                  ? t`Commenter`
                  : t`Historique`}
            </button>
          )}
        </div>
        {tache.statut === 'FAITE' &&
          (tache.clotureePar || tache.realiseePar) && (
            <p className="rt-note" style={{ margin: 0 }}>
              {[
                tache.clotureePar &&
                  (tache.clotureePar.id === moiId
                    ? t`Cochée par vous.`
                    : t`Cochée par ${nomCloture}.`),
                tache.realiseePar &&
                  (tache.realiseePar.id === moiId
                    ? t`Réalisée par vous.`
                    : t`Réalisée par ${nomRealisation}.`),
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
          )}
        {resume && resume.total > 0 && (
          <DeclinaisonsTache
            tacheId={tache.id}
            titre={tache.titre}
            resume={resume}
            editionId={editionId}
            estAdmin={estAdmin}
          />
        )}
      </div>

      {peutModifier && (
        <div className="rt-carte-tache-actions">
          {gererAssignes &&
            assignables.length > 0 &&
            (choixAssignation ? (
              <Select
                size="small"
                showSearch
                autoFocus
                defaultOpen
                value={null}
                placeholder={t`Assigner une personne`}
                optionFilterProp="label"
                style={{ minWidth: 190 }}
                disabled={enAction}
                onBlur={() => setChoixAssignation(false)}
                options={assignables.map(r => ({
                  value: r.id,
                  label: r.nom,
                }))}
                onChange={(personneId: string) => {
                  setChoixAssignation(false)
                  const personne = assignables.find(r => r.id === personneId)
                  if (personne) void assignerAutre(personne)
                }}
              />
            ) : (
              <Button
                size="small"
                icon={<UserAddOutlined />}
                disabled={enAction}
                onClick={() => setChoixAssignation(true)}
              >
                <Trans>Assigner</Trans>
              </Button>
            ))}
          {ouverte && (assignee || affectee) && (
            <Button
              size="small"
              className={assignee ? undefined : 'rt-bouton-engagement'}
              loading={assignation.loading}
              onClick={() =>
                void executer(
                  () =>
                    assigner({
                      variables: { id: tache.id, assigne: !assignee },
                    }),
                  assignee
                    ? t`Vous êtes retiré·e de la tâche.`
                    : t`La tâche vous est assignée.`
                )
              }
            >
              {assignee ? t`Me retirer` : t`Je m’en occupe`}
            </Button>
          )}
          {ouverte ? (
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              disabled={enAction}
              onClick={() => setCloture(true)}
            >
              {t({
                message: 'Faite',
                comment: 'Bouton qui marque une tâche comme faite',
              })}
            </Button>
          ) : (
            <Button
              size="small"
              icon={<UndoOutlined />}
              disabled={enAction}
              onClick={() => void statut('A_FAIRE', t`Tâche rouverte.`)}
            >
              <Trans>Rouvrir</Trans>
            </Button>
          )}
          {autresActions.length > 0 && (
            <Dropdown
              trigger={['click']}
              menu={{
                items: autresActions,
                onClick: ({ key }) => {
                  if (key === 'modifier') onModifier?.(tache)
                  if (key === 'decliner') setADecliner(true)
                  if (key === 'reunion') onPlanifierReunion?.(tache)
                  if (key === 'EN_COURS')
                    void statut('EN_COURS', t`Tâche marquée en cours.`)
                  if (key === 'A_FAIRE')
                    void statut('A_FAIRE', t`Tâche remise à faire.`)
                  if (key === 'ABANDONNEE')
                    void statut('ABANDONNEE', t`Tâche abandonnée.`)
                },
              }}
            >
              <Button
                size="small"
                icon={<MoreOutlined />}
                aria-label={t`Autres actions`}
              />
            </Dropdown>
          )}
        </div>
      )}

      <Modal
        open={cloture}
        title={t`Marquer la tâche comme faite`}
        okText={t`Marquer comme faite`}
        cancelText={t`Annuler`}
        confirmLoading={changement.loading}
        onOk={() => void terminer()}
        onCancel={() => setCloture(false)}
        destroyOnHidden
      >
        <Typography.Paragraph>
          <Trans>« {titreTache} »</Trans>
        </Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item
            label={t`Réalisée par (facultatif)`}
            extra={t`Cette information n’est visible que par vous et par les admins.`}
          >
            <Select
              allowClear
              placeholder={t`Choisir une personne`}
              value={realiseeParId}
              onChange={v => setRealiseeParId(v ?? null)}
              options={referents.map(r => ({
                value: r.id,
                label: r.id === moiId ? t`Vous` : r.nom,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
      {filLisible && (
        <FilTache
          tache={tache}
          moiId={moiId}
          ouvert={fil}
          onFermer={() => setFil(false)}
        />
      )}
      {declinable && (
        <DeclinerTache
          tache={aDecliner ? tache : null}
          dejaPartagee={(resume?.total ?? 0) > 0}
          perimetres={perimetresCibles}
          estAdmin={estAdmin}
          onFermer={() => setADecliner(false)}
        />
      )}
    </article>
  )
}
