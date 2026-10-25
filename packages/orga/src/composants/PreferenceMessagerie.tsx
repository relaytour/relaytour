import { MailOutlined } from '@ant-design/icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { Alert, App, Button, Segmented, Space } from 'antd'
import { useState } from 'react'

import {
  SEPARATEURS,
  enregistrerMessagerie,
  enregistrerSeparateur,
  envoiDEssai,
  lienVers,
  lireMessagerie,
  lireSeparateur,
  messagerie,
  observerOuverture,
  ouvrirLaMessagerie,
  type CleMessagerie,
  type Separateur,
} from '../lib/messagerie'
import { useSession } from '../lib/session'

import ChoixMessagerie, { LienGuideMessagerie } from './ChoixMessagerie'
import { Panneau } from './Panneau'

// Réglage de la messagerie qui reçoit les messages préparés (ADR 0022). Le choix
// se garde dans le navigateur. Une application ouverte par son schéma d'URL ne
// s'enregistre qu'après un essai que la personne confirme.

/** L'essai en cours : la cible, puis ce que la page a observé et ce que la personne répond. */
interface Essai {
  cle: CleMessagerie
  /** Null pendant l'observation, puis vrai quand la page a perdu la main. */
  observee: boolean | null
  reponse: 'oui' | 'non' | null
}

export default function PreferenceMessagerie() {
  const { t } = useLingui()
  const { message } = App.useApp()
  const { moi } = useSession()
  const [enregistree, setEnregistree] = useState(lireMessagerie)
  const [choix, setChoix] = useState(enregistree)
  const [essai, setEssai] = useState<Essai | null>(null)
  // Le signe qui sépare les adresses copiées, pour la messagerie par défaut.
  const [separateurEnregistre, setSeparateurEnregistre] =
    useState(lireSeparateur)
  const [separateur, setSeparateur] = useState(separateurEnregistre)

  const cible = messagerie(choix)
  const application = cible.genre === 'application'
  const essaiDuChoix = essai?.cle === choix ? essai : null
  // Une application déjà enregistrée a passé son essai sur ce navigateur.
  const libelleMessagerie = cible.libelle
  const aEssayer =
    application && choix !== enregistree && essaiDuChoix?.reponse !== 'oui'

  const essayer = async () => {
    setEssai({ cle: choix, observee: null, reponse: null })
    const observation = application
      ? observerOuverture()
      : Promise.resolve(true)
    ouvrirLaMessagerie(lienVers(choix, envoiDEssai(moi.email)))
    const observee = await observation
    setEssai(e => (e?.cle === choix ? { ...e, observee } : e))
  }

  const repondre = (reponse: 'oui' | 'non') =>
    setEssai(e => (e === null ? e : { ...e, reponse }))

  const enregistrer = () => {
    // Les deux écritures sont indépendantes : chaque réglage gardé se reflète
    // tout de suite, et un nouvel essai ne porte que sur celui qui a échoué.
    const cibleGardee = enregistrerMessagerie(choix)
    const separateurGarde = enregistrerSeparateur(separateur)
    if (cibleGardee) setEnregistree(choix)
    if (separateurGarde) setSeparateurEnregistre(separateur)
    if (!cibleGardee || !separateurGarde) {
      message.error(
        t`Votre navigateur refuse de garder ce choix. Vous pouvez choisir la messagerie dans la fenêtre de chaque message.`
      )
      return
    }
    message.success(t`Votre messagerie est enregistrée pour ce navigateur.`)
  }

  return (
    <Panneau titre={t`Votre messagerie`} icone={<MailOutlined />}>
      <p className="rt-texte-secondaire">
        <Trans>
          Quand vous préparez un message, l’espace organisateur ouvre votre
          messagerie par un lien <code>mailto:</code>. Ce lien ouvre
          l’application de mail réglée par défaut sur votre appareil. Vous
          pouvez choisir ici une autre messagerie.
        </Trans>{' '}
        <LienGuideMessagerie>
          {t`Lire le mode d’emploi « Choisir votre messagerie »`}
        </LienGuideMessagerie>
      </p>
      <ChoixMessagerie
        valeur={choix}
        choisir={setChoix}
        style={{ width: '100%', maxWidth: 420 }}
      />
      <p className="rt-note">{cible.detail}</p>
      {cible.separateur === null && (
        <div>
          <Space wrap size={8}>
            <span id="rt-preference-separateur">
              <Trans>Séparateur des adresses copiées</Trans>
            </span>
            <Segmented<Separateur>
              aria-labelledby="rt-preference-separateur"
              value={separateur}
              onChange={setSeparateur}
              options={(Object.keys(SEPARATEURS) as Separateur[]).map(s => ({
                value: s,
                label: `${SEPARATEURS[s]} (${s})`,
              }))}
            />
          </Space>
          <p className="rt-note" style={{ marginTop: 6 }}>
            <Trans>
              Choisissez le point-virgule si votre messagerie par défaut est
              Outlook : il ne découpe pas des adresses collées avec des
              virgules. Vous pouvez changer ce signe à côté des boutons de copie
              de chaque message.
            </Trans>
          </p>
        </div>
      )}

      {essaiDuChoix !== null && essaiDuChoix.observee !== null && (
        <>
          {essaiDuChoix.observee === false && essaiDuChoix.reponse === null && (
            <Alert
              type="warning"
              showIcon
              title={t`L’application ne semble pas s’être ouverte`}
              description={t`Votre navigateur n’a pas quitté cette page. L’application n’est peut-être pas installée sur cet appareil, ou ne répond pas à ce lien.`}
            />
          )}
          {essaiDuChoix.reponse === null && (
            <div>
              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
                <Trans>
                  Un message d’essai s’est-il ouvert dans « {libelleMessagerie}{' '}
                  » ?
                </Trans>
              </p>
              <Space wrap>
                <Button onClick={() => repondre('oui')}>
                  <Trans>Oui, le message s’est ouvert</Trans>
                </Button>
                <Button onClick={() => repondre('non')}>
                  <Trans>Non</Trans>
                </Button>
              </Space>
            </div>
          )}
          {essaiDuChoix.reponse === 'oui' && (
            <Alert
              type="success"
              showIcon
              title={t`L’essai a réussi`}
              description={
                cible.copiesEtablies
                  ? t`Vous pouvez fermer le message d’essai sans l’envoyer.`
                  : t`Vérifiez que votre adresse figure dans le champ « Cci » du message d’essai. Si ce champ est vide, cette messagerie ne reprend pas les adresses cachées : vous les collerez vous-même.`
              }
            />
          )}
          {essaiDuChoix.reponse === 'non' && (
            <Alert
              type="info"
              showIcon
              title={t`Choisissez une autre messagerie`}
              description={
                <>
                  <Trans>
                    Gardez la messagerie par défaut de l’appareil, ou choisissez
                    une messagerie en ligne.
                  </Trans>{' '}
                  <LienGuideMessagerie>
                    {t`Le mode d’emploi décrit chaque choix.`}
                  </LienGuideMessagerie>
                </>
              }
            />
          )}
        </>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <p className="rt-note" style={{ maxWidth: 400, margin: 0 }}>
          {aEssayer
            ? t`Essayez cette application avant d’enregistrer : elle ne répond pas sur tous les appareils.`
            : t`Ce choix vaut pour ce navigateur, sur cet appareil. Vous pouvez le changer pour un message dans la fenêtre « Écrire un message ».`}
        </p>
        <Space wrap>
          <Button
            loading={essaiDuChoix?.observee === null}
            onClick={() => void essayer()}
          >
            <Trans>Essayer</Trans>
          </Button>
          <Button
            type="primary"
            disabled={
              aEssayer ||
              (choix === enregistree && separateur === separateurEnregistre)
            }
            onClick={enregistrer}
          >
            <Trans>Enregistrer</Trans>
          </Button>
        </Space>
      </div>
    </Panneau>
  )
}
