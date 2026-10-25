import { DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import type { MessageDescriptor } from '@lingui/core'
import { msg, plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Alert,
  App,
  Button,
  Grid,
  Progress,
  Result,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { sansAccent } from '@relaytour/commun'
import { useMemo, useState, type ReactNode } from 'react'

import type { EtatLigneImport } from '../gql/graphql'
import { messageErreur } from '../lib/erreurs'
import {
  csvDesEcartees,
  detecterColonnesSelon,
  enLots,
  lireFichier,
  type ColonneDetectee,
  type Feuille,
  type LigneEcartee,
  type ReglesDetection,
  type Tableau,
} from '../lib/import-tableur'

// Assistant commun des imports de tableurs (ADR 0049) : le fichier, l'association
// des colonnes, la vérification par le serveur, puis l'import par lots. Le fichier
// se lit dans le navigateur ; seules les colonnes associées partent, ligne par
// ligne. Chaque import décrit ses champs, construit ses lignes et appelle ses
// propres requêtes.

export interface ChampTableur<C extends string> {
  valeur: C
  libelle: string
  /** Un champ qu'au moins une colonne doit recevoir. */
  obligatoire?: boolean
}

export interface LigneRapportTableur {
  ligne: number
  etat: EtatLigneImport
  raison?: string | null
  avertissements: string[]
}

interface Props<C extends string, L extends { ligne: number }> {
  champs: ChampTableur<C>[]
  regles: ReglesDetection<C>
  /** Le classeur modèle, en CSV : ses en-têtes et deux lignes d'exemple fictives. */
  modele: { nom: string; entetes: string[]; exemples: string[][] }
  /** Les lignes à envoyer, et celles que le navigateur écarte déjà. */
  construire: (
    tableau: Tableau,
    associations: readonly C[]
  ) => { lignes: L[]; ecartees: LigneEcartee[] }
  /** Les réglages propres à l'import, montrés avant la vérification. */
  reglages?: ReactNode
  /** Faux tant qu'un réglage obligatoire manque. */
  pret?: boolean
  /** Les réglages en texte : une vérification faite avec d'autres réglages ne vaut plus. */
  cleReglages?: string
  simuler: (lot: L[]) => Promise<LigneRapportTableur[]>
  importer: (lot: L[]) => Promise<LigneRapportTableur[]>
  /** Appelé avant le premier lot d'une vérification ou d'un import. */
  onDebut?: (ecrire: boolean) => void
  /** Ce que la vérification annonce en plus des lignes, par exemple les créations. */
  resumeVerification?: ReactNode
  /** Le résumé propre à l'import, affiché à la fin. */
  bilan?: ReactNode
  /** L'action qui suit l'import, par exemple un lien vers l'écran concerné. */
  suite: ReactNode
}

const ETAPES: MessageDescriptor[] = [
  msg({
    message: 'Fichier',
    comment: 'Première étape de l’assistant d’import d’un tableur',
  }),
  msg({
    message: 'Colonnes',
    comment: 'Deuxième étape de l’assistant d’import d’un tableur',
  }),
  msg({
    message: 'Vérification',
    comment: 'Troisième étape de l’assistant d’import d’un tableur',
  }),
  msg({
    message: 'Import',
    comment: 'Dernière étape de l’assistant d’import d’un tableur',
  }),
]

const COULEURS: Record<EtatLigneImport, string> = {
  A_IMPORTER: 'blue',
  IMPORTEE: 'green',
  DEJA_IMPORTEE: 'default',
  ECARTEE: 'warning',
}

/** Propose un téléchargement d'un texte, sous un nom de fichier. */
function telecharger(nom: string, texte: string) {
  const url = URL.createObjectURL(
    new Blob([`﻿${texte}`], { type: 'text/csv;charset=utf-8' })
  )
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(url)
}

export default function AssistantTableur<
  C extends string,
  L extends { ligne: number },
>({
  champs,
  regles,
  modele,
  construire,
  reglages,
  pret = true,
  cleReglages = '',
  simuler,
  importer,
  onDebut,
  resumeVerification,
  bilan,
  suite,
}: Props<C, L>) {
  const { t } = useLingui()
  const { message } = App.useApp()
  const ecrans = Grid.useBreakpoint()
  const [etape, setEtape] = useState(0)
  const [feuilles, setFeuilles] = useState<Feuille[]>([])
  const [nomFeuille, setNomFeuille] = useState<string>()
  const [associations, setAssociations] = useState<C[]>([])
  const [verification, setRapport] = useState<{
    lignes: LigneRapportTableur[]
    cle: string
  } | null>(null)
  // Un rapport ne vaut que pour les réglages avec lesquels il a été calculé.
  const rapport =
    verification !== null && verification.cle === cleReglages
      ? verification.lignes
      : null
  const [enCours, setEnCours] = useState(false)
  const [progression, setProgression] = useState(0)
  const [fini, setFini] = useState(false)
  // Le message d'un import arrêté en cours de route : les lots déjà écrits restent.
  const [echec, setEchec] = useState<string | null>(null)

  const feuille = feuilles.find(f => f.nom === nomFeuille) ?? feuilles[0]
  const tableau = feuille?.tableau
  const lues = tableau?.lignes.length ?? 0
  const colonnes: ColonneDetectee<C>[] = useMemo(
    () => (tableau ? detecterColonnesSelon(tableau, regles, sansAccent) : []),
    [tableau, regles]
  )
  const choisir = (f: Feuille) => {
    setNomFeuille(f.nom)
    setAssociations(
      detecterColonnesSelon(f.tableau, regles, sansAccent).map(c => c.champ)
    )
    setRapport(null)
  }
  const construction = useMemo(
    () => (tableau ? construire(tableau, associations) : null),
    [tableau, associations, construire]
  )
  const manquants = champs.filter(
    c => c.obligatoire && !associations.includes(c.valeur)
  )
  const listeManquants = manquants.map(m => m.libelle).join(', ')

  const lire = async (fichier: File) => {
    try {
      const lues = await lireFichier(fichier)
      setFeuilles(lues)
      if (lues[0]) choisir(lues[0])
    } catch (e) {
      message.error(messageErreur(e))
    }
  }

  // Les lignes écartées par le navigateur, puis le rapport du serveur, dans
  // l'ordre du fichier.
  const lignesDuRapport = useMemo(() => {
    const ecartees: LigneRapportTableur[] = (construction?.ecartees ?? []).map(
      e => ({
        ligne: e.ligne,
        etat: 'ECARTEE',
        raison: e.motif,
        avertissements: [],
      })
    )
    return [...ecartees, ...(rapport ?? [])].sort((a, b) => a.ligne - b.ligne)
  }, [construction, rapport])

  const envoyer = async (
    appel: (lot: L[]) => Promise<LigneRapportTableur[]>,
    ecrire: boolean
  ) => {
    if (!construction) return
    setEnCours(true)
    setProgression(0)
    setEchec(null)
    onDebut?.(ecrire)
    const sorties: LigneRapportTableur[] = []
    try {
      const lots = enLots(construction.lignes)
      for (const [rang, lot] of lots.entries()) {
        sorties.push(...(await appel(lot)))
        setProgression(Math.round(((rang + 1) / lots.length) * 100))
      }
      setRapport({ lignes: sorties, cle: cleReglages })
      if (ecrire) setFini(true)
    } catch (e) {
      if (ecrire) {
        // Les lots déjà écrits le restent : l'écran les montre, et un nouvel
        // import ne les recrée pas.
        setRapport({ lignes: sorties, cle: cleReglages })
        setEchec(messageErreur(e))
        setFini(true)
      } else {
        message.error(messageErreur(e))
      }
    } finally {
      setEnCours(false)
    }
  }

  const compte = (etat: EtatLigneImport) =>
    lignesDuRapport.filter(l => l.etat === etat).length
  const aImporter = compte('A_IMPORTER')
  const importees = compte('IMPORTEE')
  const deja = compte('DEJA_IMPORTEE')
  const ecartees = compte('ECARTEE')
  const libelleEtat: Record<EtatLigneImport, string> = {
    A_IMPORTER: t`À importer`,
    IMPORTEE: t`Importée`,
    DEJA_IMPORTEE: t`Déjà importée`,
    ECARTEE: t`Écartée`,
  }

  const telechargerEcartees = async () => {
    if (!tableau) return
    const lignes: LigneEcartee[] = lignesDuRapport
      .filter(l => l.etat === 'ECARTEE')
      .map(l => ({
        ligne: l.ligne,
        motif: l.raison ?? '',
        valeurs: tableau.lignes[l.ligne - 2] ?? [],
      }))
    telecharger(
      t`lignes-ecartees.csv`,
      await csvDesEcartees(tableau.entetes, lignes, tableau.separateur)
    )
  }

  const tableauRapport = (
    <Table<LigneRapportTableur>
      rowKey="ligne"
      size="small"
      dataSource={lignesDuRapport}
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      columns={[
        { title: t`Ligne`, dataIndex: 'ligne', width: 80 },
        {
          title: t`État`,
          dataIndex: 'etat',
          width: 140,
          render: (etat: EtatLigneImport) => (
            <Tag color={COULEURS[etat]}>{libelleEtat[etat]}</Tag>
          ),
        },
        {
          title: t`Détail`,
          render: (_, l) =>
            [l.raison, ...l.avertissements].filter(Boolean).join(' · ') || null,
        },
      ]}
    />
  )

  const numeroEtape = etape + 1
  const nombreEtapes = ETAPES.length
  const nomEtape = t(ETAPES[etape]!)

  return (
    <>
      {ecrans.md ? (
        <Steps
          current={etape}
          size="small"
          items={ETAPES.map(nom => ({ title: t(nom) }))}
          style={{ marginBottom: 24 }}
        />
      ) : (
        <p className="rt-note">
          <Trans>
            Étape {numeroEtape} sur {nombreEtapes} : {nomEtape}
          </Trans>
        </p>
      )}

      {etape === 0 && (
        <section className="rt-verre rt-import-etape">
          <Upload.Dragger
            accept=".csv,.txt,.xlsx"
            maxCount={1}
            showUploadList={false}
            beforeUpload={fichier => {
              void lire(fichier)
              return false
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p>
              <Trans>
                Déposez un fichier CSV ou Excel (.xlsx), ou cliquez pour le
                choisir.
              </Trans>
            </p>
            <p className="rt-note">
              <Trans>2 Mo, 5 000 lignes et 200 colonnes au plus.</Trans>
            </p>
          </Upload.Dragger>
          {feuilles.length > 1 && (
            <label className="rt-import-champ">
              <span className="rt-libelle">{t`Feuille`}</span>
              <Select
                aria-label={t`Feuille du classeur`}
                value={feuille?.nom}
                onChange={nom => {
                  const f = feuilles.find(x => x.nom === nom)
                  if (f) choisir(f)
                }}
                options={feuilles.map(f => ({ value: f.nom, label: f.nom }))}
              />
            </label>
          )}
          {tableau && (
            <Alert
              type="success"
              showIcon
              title={t`${plural(lues, { one: '# ligne lue', other: '# lignes lues' })}.`}
            />
          )}
          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                void import('papaparse').then(({ default: Papa }) =>
                  telecharger(
                    modele.nom,
                    Papa.unparse(
                      { fields: modele.entetes, data: modele.exemples },
                      { delimiter: ';' }
                    )
                  )
                )
              }
            >
              <Trans>Télécharger le modèle</Trans>
            </Button>
            <Button
              type="primary"
              disabled={!tableau || tableau.lignes.length === 0}
              onClick={() => setEtape(1)}
            >
              <Trans>Continuer</Trans>
            </Button>
          </Space>
        </section>
      )}

      {etape === 1 && tableau && (
        <section className="rt-verre rt-import-etape">
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <Trans>
              Chaque colonne reçoit un champ, proposé d’après son en-tête et son
              contenu. Une colonne ignorée ne part pas.
            </Trans>
          </Typography.Paragraph>
          <Table<ColonneDetectee<C>>
            rowKey="index"
            size="small"
            pagination={false}
            dataSource={colonnes}
            columns={[
              { title: t`Colonne du fichier`, dataIndex: 'entete' },
              {
                title: t`Exemples`,
                render: (_, c) => (
                  <span className="rt-texte-secondaire">
                    {c.exemples.join(' · ')}
                  </span>
                ),
              },
              {
                title: t`Champ`,
                width: 260,
                render: (_, c) => {
                  const entete = c.entete
                  return (
                    <Select<C>
                      aria-label={t`Champ de la colonne ${entete}`}
                      style={{ width: '100%' }}
                      disabled={c.sensible}
                      value={associations[c.index] ?? regles.ignorer}
                      onChange={champ => {
                        const suivantes = [...associations]
                        suivantes[c.index] = champ
                        setAssociations(suivantes)
                        setRapport(null)
                      }}
                      options={champs.map(ch => ({
                        value: ch.valeur,
                        label: ch.libelle,
                      }))}
                    />
                  )
                },
              },
            ]}
          />
          {manquants.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={t`Associez une colonne à chaque champ obligatoire : ${listeManquants}.`}
            />
          )}
          <Space wrap>
            <Button onClick={() => setEtape(0)}>
              <Trans>Retour</Trans>
            </Button>
            <Button
              type="primary"
              disabled={manquants.length > 0}
              onClick={() => setEtape(2)}
            >
              <Trans>Continuer</Trans>
            </Button>
          </Space>
        </section>
      )}

      {etape === 2 && construction && (
        <section className="rt-verre rt-import-etape">
          {reglages}
          <Space wrap>
            <Button onClick={() => setEtape(1)}>
              <Trans>Retour</Trans>
            </Button>
            <Button
              loading={enCours}
              disabled={!pret}
              onClick={() => void envoyer(simuler, false)}
            >
              <Trans>Vérifier</Trans>
            </Button>
          </Space>
          {enCours && <Progress percent={progression} />}
          {rapport && (
            <>
              <Alert
                type={ecartees > 0 ? 'warning' : 'info'}
                showIcon
                title={t`${plural(aImporter, { one: '# ligne à importer', other: '# lignes à importer' })}, ${plural(deja, { one: '# déjà importée', other: '# déjà importées' })}, ${plural(ecartees, { one: '# écartée', other: '# écartées' })}.`}
              />
              {resumeVerification}
              {tableauRapport}
              <Space wrap>
                {ecartees > 0 && (
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={() => void telechargerEcartees()}
                  >
                    <Trans>Télécharger les lignes écartées</Trans>
                  </Button>
                )}
                <Button
                  type="primary"
                  disabled={aImporter === 0}
                  onClick={() => {
                    setEtape(3)
                    void envoyer(importer, true)
                  }}
                >
                  {t`Importer ${plural(aImporter, { one: '# ligne', other: '# lignes' })}`}
                </Button>
              </Space>
            </>
          )}
        </section>
      )}

      {etape === 3 && (
        <section className="rt-verre rt-import-etape">
          {enCours || !fini ? (
            <Progress percent={progression} />
          ) : (
            <>
              {echec !== null && (
                <Alert
                  type="error"
                  showIcon
                  title={t`L’import s’est arrêté avant la fin : ${echec}`}
                  description={t`Les lignes ci-dessous sont écrites. Revenez à la vérification pour relancer l’import : une ligne déjà importée ne sera pas recréée.`}
                  action={
                    <Button
                      onClick={() => {
                        setFini(false)
                        setEchec(null)
                        setRapport(null)
                        setEtape(2)
                      }}
                    >
                      <Trans>Revenir à la vérification</Trans>
                    </Button>
                  }
                />
              )}
              <Result
                status={echec === null ? 'success' : 'warning'}
                title={t`${plural(importees, { one: '# ligne importée', other: '# lignes importées' })}.`}
                subTitle={
                  deja + ecartees > 0
                    ? t`${plural(deja, { one: '# déjà importée', other: '# déjà importées' })}, ${plural(ecartees, { one: '# écartée', other: '# écartées' })}.`
                    : undefined
                }
                extra={suite}
              />
              {bilan}
              {tableauRapport}
              {ecartees > 0 && (
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => void telechargerEcartees()}
                >
                  <Trans>Télécharger les lignes écartées</Trans>
                </Button>
              )}
            </>
          )}
        </section>
      )}
    </>
  )
}
