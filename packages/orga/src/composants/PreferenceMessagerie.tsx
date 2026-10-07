import { MailOutlined } from '@ant-design/icons'
import { Alert, App, Button, Space } from 'antd'
import { useState } from 'react'

import {
  enregistrerMessagerie,
  envoiDEssai,
  lienVers,
  lireMessagerie,
  messagerie,
  observerOuverture,
  ouvrirLaMessagerie,
  type CleMessagerie,
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
  const { message } = App.useApp()
  const { moi } = useSession()
  const [enregistree, setEnregistree] = useState(lireMessagerie)
  const [choix, setChoix] = useState(enregistree)
  const [essai, setEssai] = useState<Essai | null>(null)

  const cible = messagerie(choix)
  const application = cible.genre === 'application'
  const essaiDuChoix = essai?.cle === choix ? essai : null
  // Une application déjà enregistrée a passé son essai sur ce navigateur.
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
    if (!enregistrerMessagerie(choix)) {
      message.error(
        'Votre navigateur refuse de garder ce choix. Vous pouvez choisir la messagerie dans la fenêtre de chaque message.'
      )
      return
    }
    setEnregistree(choix)
    message.success('Votre messagerie est enregistrée pour ce navigateur.')
  }

  return (
    <Panneau titre="Votre messagerie" icone={<MailOutlined />}>
      <p className="rt-texte-secondaire">
        Quand vous préparez un message, l’espace organisateur ouvre votre
        messagerie par un lien <code>mailto:</code>. Ce lien ouvre l’application
        de mail réglée par défaut sur votre appareil. Vous pouvez choisir ici
        une autre messagerie.{' '}
        <LienGuideMessagerie>
          Lire le mode d’emploi « Choisir votre messagerie »
        </LienGuideMessagerie>
      </p>
      <ChoixMessagerie
        valeur={choix}
        choisir={setChoix}
        style={{ width: '100%', maxWidth: 420 }}
      />
      <p className="rt-note">{cible.detail}</p>

      {essaiDuChoix !== null && essaiDuChoix.observee !== null && (
        <>
          {essaiDuChoix.observee === false && essaiDuChoix.reponse === null && (
            <Alert
              type="warning"
              showIcon
              title="L’application ne semble pas s’être ouverte"
              description={`Votre navigateur n’a pas quitté cette page. L’application n’est peut-être pas installée sur cet appareil, ou ne répond pas à ce lien.`}
            />
          )}
          {essaiDuChoix.reponse === null && (
            <div>
              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
                Un message d’essai s’est-il ouvert dans « {cible.libelle} » ?
              </p>
              <Space wrap>
                <Button onClick={() => repondre('oui')}>
                  Oui, le message s’est ouvert
                </Button>
                <Button onClick={() => repondre('non')}>Non</Button>
              </Space>
            </div>
          )}
          {essaiDuChoix.reponse === 'oui' && (
            <Alert
              type="success"
              showIcon
              title="L’essai a réussi"
              description={
                cible.copiesEtablies
                  ? 'Vous pouvez fermer le message d’essai sans l’envoyer.'
                  : 'Vérifiez que votre adresse figure dans le champ « Cci » du message d’essai. Si ce champ est vide, cette messagerie ne reprend pas les adresses cachées : vous les collerez vous-même.'
              }
            />
          )}
          {essaiDuChoix.reponse === 'non' && (
            <Alert
              type="info"
              showIcon
              title="Choisissez une autre messagerie"
              description={
                <>
                  Gardez la messagerie par défaut de l’appareil, ou choisissez
                  une messagerie en ligne.{' '}
                  <LienGuideMessagerie>
                    Le mode d’emploi décrit chaque choix.
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
            ? 'Essayez cette application avant d’enregistrer : elle ne répond pas sur tous les appareils.'
            : 'Ce choix vaut pour ce navigateur, sur cet appareil. Vous pouvez le changer pour un message dans la fenêtre « Écrire un message ».'}
        </p>
        <Space wrap>
          <Button
            loading={essaiDuChoix?.observee === null}
            onClick={() => void essayer()}
          >
            Essayer
          </Button>
          <Button
            type="primary"
            disabled={aEssayer || choix === enregistree}
            onClick={enregistrer}
          >
            Enregistrer
          </Button>
        </Space>
      </div>
    </Panneau>
  )
}
