import { InboxOutlined, UploadOutlined } from '@ant-design/icons'
import { useApolloClient } from '@apollo/client/react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, App, Button, Checkbox, Space, Upload } from 'antd'
import { useState } from 'react'

import {
  deposerContenu,
  ErreurDepot,
  type RapportActiviteDepot,
  type RapportDepot,
} from '../lib/depot-contenu'
import { jourDeLInstant } from '../lib/erreurs'

// Dépôt d'un dossier de contenu (ADR 0049) : l'archive se simule dès qu'elle est
// choisie, puis s'importe sur confirmation. Avec une activité, seul le dossier de
// cette activité s'importe.

/** Une ligne du rapport : un libellé et des slugs, masquée sans slug. */
function Ligne({ libelle, slugs }: { libelle: string; slugs: string[] }) {
  if (slugs.length === 0) return null
  return (
    <li>
      <span className="rt-libelle">{libelle}</span> {slugs.join(', ')}
    </li>
  )
}

function RapportActivite({ activite }: { activite: RapportActiviteDepot }) {
  const { t } = useLingui()
  const slug = activite.slug
  const titre =
    activite.etat === 'creee'
      ? t`Activité ${slug} : créée`
      : t`Activité ${slug} : mise à jour`
  const rien =
    [
      ...Object.values(activite.perimetres),
      activite.fiches.creees,
      activite.fiches.nouvellesVersions,
      activite.fiches.conflits,
    ].every(l => l.length === 0) && activite.etat !== 'creee'
  return (
    <div className="rt-depot-activite">
      <strong>{titre}</strong>
      {rien ? (
        <p className="rt-texte-secondaire">
          <Trans>Aucun changement.</Trans>
        </p>
      ) : (
        <ul>
          <Ligne
            libelle={t`Périmètres créés :`}
            slugs={activite.perimetres.crees}
          />
          <Ligne
            libelle={t`Périmètres modifiés :`}
            slugs={activite.perimetres.modifies}
          />
          <Ligne
            libelle={t`Périmètres absents de l’archive (gardés) :`}
            slugs={activite.perimetres.absentsDuDepot}
          />
          <Ligne libelle={t`Fiches créées :`} slugs={activite.fiches.creees} />
          <Ligne
            libelle={t`Fiches mises à jour :`}
            slugs={activite.fiches.nouvellesVersions}
          />
          <Ligne
            libelle={t`Fiches en conflit (non remplacées) :`}
            slugs={activite.fiches.conflits}
          />
        </ul>
      )}
    </div>
  )
}

export default function DepotContenu({
  activiteId = null,
}: {
  /** L'activité dont seul le dossier s'importe, ou null pour toute l'organisation. */
  activiteId?: string | null
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const apollo = useApolloClient()
  const [fichier, setFichier] = useState<File | null>(null)
  const [rapport, setRapport] = useState<RapportDepot | null>(null)
  const [erreur, setErreur] = useState<ErreurDepot | null>(null)
  const [confirme, setConfirme] = useState(false)
  const [enCours, setEnCours] = useState<'simulation' | 'import' | null>(null)

  const recommencer = () => {
    setFichier(null)
    setRapport(null)
    setErreur(null)
    setConfirme(false)
  }

  const simuler = async (choisi: File) => {
    recommencer()
    setFichier(choisi)
    setEnCours('simulation')
    try {
      setRapport(
        await deposerContenu(choisi, {
          activiteId,
          simulation: true,
          forcer: false,
        })
      )
    } catch (e) {
      setErreur(e instanceof ErreurDepot ? e : new ErreurDepot(String(e)))
    } finally {
      setEnCours(null)
    }
  }

  const importer = async () => {
    if (fichier === null || rapport === null) return
    setEnCours('import')
    setErreur(null)
    try {
      await deposerContenu(fichier, {
        activiteId,
        simulation: false,
        forcer: rapport.modifieDansApplication !== null && confirme,
      })
      message.success(t`Le dossier de contenu est importé.`)
      recommencer()
      await apollo.refetchQueries({ include: 'active' })
    } catch (e) {
      setErreur(e instanceof ErreurDepot ? e : new ErreurDepot(String(e)))
    } finally {
      setEnCours(null)
    }
  }

  const nomFichier = fichier?.name ?? ''
  const dateModification = rapport?.modifieDansApplication
    ? jourDeLInstant(rapport.modifieDansApplication)
    : ''
  const slugIgnore = rapport?.slugIgnore ?? ''
  const nombreIgnores = rapport?.fichiersIgnores.length ?? 0
  const bloque =
    rapport === null || (rapport.modifieDansApplication !== null && !confirme)

  return (
    <div className="rt-depot-contenu">
      {rapport === null && (
        <Upload.Dragger
          accept=".zip,application/zip"
          maxCount={1}
          showUploadList={false}
          disabled={enCours !== null}
          beforeUpload={choisi => {
            void simuler(choisi)
            return false
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p>
            {activiteId === null ? (
              <Trans>
                Déposez l’archive zip du contenu, ou cliquez pour la choisir.
              </Trans>
            ) : (
              <Trans>
                Déposez l’archive zip du contenu ou du seul dossier de
                l’activité, ou cliquez pour la choisir.
              </Trans>
            )}
          </p>
          <p className="rt-note">
            <Trans>
              20 Mo au plus. Le contenu est vérifié avant tout import.
            </Trans>
          </p>
        </Upload.Dragger>
      )}

      {enCours === 'simulation' && (
        <p className="rt-texte-secondaire">
          <Trans>Vérification de {nomFichier}…</Trans>
        </p>
      )}

      {erreur && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 16 }}
          title={erreur.message}
          description={
            erreur.erreurs.length > 0 && (
              <ul className="rt-liste-erreurs">
                {erreur.erreurs.map(e => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )
          }
          action={
            rapport === null && (
              <Button size="small" onClick={recommencer}>
                <Trans>Choisir une autre archive</Trans>
              </Button>
            )
          }
        />
      )}

      {rapport && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <p>
            <Trans>
              Vérification de {nomFichier} terminée. Rien n’est encore importé.
            </Trans>
          </p>
          {rapport.activites.map(a => (
            <RapportActivite key={a.slug} activite={a} />
          ))}
          {activiteId === null &&
            rapport.activitesAbsentesDuDepot.length > 0 && (
              <ul className="rt-texte-secondaire">
                <Ligne
                  libelle={t`Activités absentes de l’archive (gardées) :`}
                  slugs={rapport.activitesAbsentesDuDepot}
                />
              </ul>
            )}
          {rapport.amorcageRetire && (
            <p className="rt-texte-secondaire">
              <Trans>
                L’activité créée avec l’organisation est vide et absente de
                l’archive : l’import la retire.
              </Trans>
            </p>
          )}
          {rapport.slugIgnore !== null && (
            <p className="rt-texte-secondaire">
              <Trans>
                L’archive déclare l’identifiant « {slugIgnore} ». L’organisation
                garde le sien.
              </Trans>
            </p>
          )}
          {nombreIgnores > 0 && (
            <details>
              <summary className="rt-texte-secondaire">
                {t`${plural(nombreIgnores, {
                  one: '# fichier de l’archive ignoré',
                  other: '# fichiers de l’archive ignorés',
                })}`}
              </summary>
              <ul className="rt-liste-erreurs">
                {rapport.fichiersIgnores.map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          )}
          {rapport.modifieDansApplication !== null && (
            <Alert
              type="warning"
              showIcon
              title={t`Des admins ont modifié le contenu le ${dateModification}, après la dernière synchronisation.`}
              description={
                <Checkbox
                  checked={confirme}
                  onChange={e => setConfirme(e.target.checked)}
                >
                  <Trans>
                    J’accepte que l’import remplace ces modifications.
                  </Trans>
                </Checkbox>
              }
            />
          )}
          <Space wrap>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              disabled={bloque}
              loading={enCours === 'import'}
              onClick={() => void importer()}
            >
              <Trans>Importer l’archive</Trans>
            </Button>
            <Button disabled={enCours !== null} onClick={recommencer}>
              <Trans>Annuler</Trans>
            </Button>
          </Space>
        </Space>
      )}
    </div>
  )
}
