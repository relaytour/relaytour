import { InboxOutlined } from '@ant-design/icons'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, App, Button, Drawer, Select, Space, Upload } from 'antd'
import type { UploadFile } from 'antd'
import { useState } from 'react'

import { useActivite } from '../lib/activite'
import { ErreurDepot } from '../lib/depot-contenu'
import {
  deposerFiches,
  FORMATS_FICHES,
  type RapportDepotFiches,
} from '../lib/depot-fiches'
import { PERIMETRES } from '../lib/requetes'
import { RapportImport } from './ImportFiches'

// Dépôt direct de fiches depuis l'écran « Ressources » (ADR 0049). L'admin de
// l'activité choisit la destination (un périmètre ou les fiches communes) et des
// fichiers Markdown, texte ou Word. Le dépôt se vérifie avant d'écrire.

const COMMUNES = ''

// Le volet se monte à l'ouverture : chaque dépôt repart d'un choix vide.
export default function DepotFiches({
  fermer,
  perimetreInitial,
}: {
  fermer: () => void
  /** Le périmètre affiché dans la liste, proposé comme destination. */
  perimetreInitial: string | null
}) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const apollo = useApolloClient()
  const { activite } = useActivite()
  const { data } = useQuery(PERIMETRES)
  const [destination, setDestination] = useState(perimetreInitial ?? COMMUNES)
  const [fichiers, setFichiers] = useState<UploadFile[]>([])
  const [rapport, setRapport] = useState<RapportDepotFiches | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<'simulation' | 'import' | null>(null)

  const choisis = fichiers.flatMap(f =>
    f.originFileObj ? [f.originFileObj as File] : []
  )

  const envoyer = async (simulation: boolean) => {
    setEnCours(simulation ? 'simulation' : 'import')
    setErreur(null)
    try {
      const resultat = await deposerFiches(choisis, {
        activiteId: activite.id,
        perimetreId: destination === COMMUNES ? null : destination,
        simulation,
      })
      if (simulation) {
        setRapport(resultat)
        return
      }
      const nombre = resultat.creees.length + resultat.nouvellesVersions.length
      message.success(
        t`${plural(nombre, {
          one: '# fiche importée.',
          other: '# fiches importées.',
        })}`
      )
      await apollo.refetchQueries({ include: 'active' })
      fermer()
    } catch (e) {
      setErreur(e instanceof ErreurDepot ? e.message : String(e))
    } finally {
      setEnCours(null)
    }
  }

  const options = [
    { value: COMMUNES, label: t`Fiches communes` },
    ...(data?.perimetres ?? [])
      .filter(p => !p.archive)
      .map(p => ({ value: p.id, label: p.nom })),
  ]
  const aImporter = rapport
    ? rapport.creees.length + rapport.nouvellesVersions.length
    : 0

  return (
    <Drawer
      open
      onClose={fermer}
      title={t`Déposer des fichiers`}
      size={560}
      footer={
        <Space>
          {rapport === null ? (
            <Button
              type="primary"
              disabled={choisis.length === 0}
              loading={enCours === 'simulation'}
              onClick={() => void envoyer(true)}
            >
              <Trans>Vérifier</Trans>
            </Button>
          ) : (
            <>
              <Button
                type="primary"
                disabled={aImporter === 0}
                loading={enCours === 'import'}
                onClick={() => void envoyer(false)}
              >
                <Trans>Importer les fiches</Trans>
              </Button>
              <Button
                disabled={enCours !== null}
                onClick={() => setRapport(null)}
              >
                <Trans>Modifier le choix</Trans>
              </Button>
            </>
          )}
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <p className="rt-texte-secondaire" style={{ margin: 0 }}>
          <Trans>
            Chaque fichier devient une fiche. Un document Word est converti en
            Markdown, sans ses images. Une fiche modifiée dans Relaytour n’est
            pas remplacée.
          </Trans>
        </p>
        <label className="rt-import-champ">
          <span className="rt-libelle">{t`Destination`}</span>
          <Select
            aria-label={t`Destination des fiches`}
            value={destination}
            disabled={rapport !== null}
            onChange={setDestination}
            options={options}
          />
        </label>
        {rapport === null ? (
          <Upload.Dragger
            accept={FORMATS_FICHES}
            multiple
            fileList={fichiers}
            beforeUpload={() => false}
            onChange={({ fileList }) => setFichiers(fileList)}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p>
              <Trans>
                Déposez des fichiers Markdown, texte ou Word (.docx), ou cliquez
                pour les choisir.
              </Trans>
            </p>
            <p className="rt-note">
              <Trans>
                2 Mo par fichier, 50 fichiers et 20 Mo par dépôt au plus.
              </Trans>
            </p>
          </Upload.Dragger>
        ) : (
          <RapportImport rapport={rapport} fait={false} />
        )}
        {erreur && <Alert type="error" showIcon title={erreur} />}
      </Space>
    </Drawer>
  )
}
