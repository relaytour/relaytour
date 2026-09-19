import { useApolloClient } from '@apollo/client/react'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import Marque from '../composants/Marque'
import {
  adresseConnexionAutomatique,
  adresseMemorisee,
  demanderCode,
  ErreurConnexion,
  lireLienConnexion,
  seConnecter,
  type LienConnexion,
} from '../lib/connexion'

type Etape = 'adresse' | 'code'

// Le lien se lit une seule fois par chargement de page : la lecture efface
// le fragment de la barre d'adresse.
let lienLu: LienConnexion | null | undefined
function lienUneFois(): LienConnexion | null {
  if (lienLu === undefined) lienLu = lireLienConnexion()
  return lienLu
}

export default function Connexion() {
  const navigate = useNavigate()
  const apollo = useApolloClient()
  const [etape, setEtape] = useState<Etape>(() =>
    lienUneFois() === null ? 'adresse' : 'code'
  )
  const [adresse, setAdresse] = useState(
    () => lienUneFois()?.adresse ?? adresseMemorisee()
  )
  const [code, setCode] = useState(() => lienUneFois()?.code ?? '')
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const lienTraite = useRef(false)

  const valider = async (adresseSaisie: string, codeSaisi: string) => {
    setEnvoiEnCours(true)
    setErreur(null)
    try {
      await seConnecter(adresseSaisie, codeSaisi)
      await apollo.resetStore()
      navigate('/', { replace: true })
    } catch (e) {
      setErreur(
        e instanceof ErreurConnexion ? e.message : 'La connexion a échoué.'
      )
      setCode('')
    } finally {
      setEnvoiEnCours(false)
    }
  }

  // Lien reçu par mail : la connexion part sans clic seulement si l'adresse du lien
  // est celle saisie dans cet onglet pour demander le code (sans adresse dans le
  // lien, l'adresse mémorisée sert). Sinon, le code et l'adresse restent préremplis
  // et la personne valide elle-même : un lien forgé par un tiers ne connecte
  // personne à son insu.
  useEffect(() => {
    if (lienTraite.current) return
    lienTraite.current = true
    const lien = lienUneFois()
    if (lien === null) return
    const adresseConnue = adresseConnexionAutomatique(lien, adresseMemorisee())
    if (adresseConnue !== null) {
      // Le lien du mail est une source externe : la connexion part au montage, une seule fois.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void valider(adresseConnue, lien.code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const envoyerCode = async () => {
    setEnvoiEnCours(true)
    setErreur(null)
    try {
      await demanderCode(adresse)
      setEtape('code')
    } catch (e) {
      setErreur(
        e instanceof ErreurConnexion ? e.message : 'L’envoi du code a échoué.'
      )
    } finally {
      setEnvoiEnCours(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div className="rt-halo rt-halo-1" aria-hidden="true" />
      <div className="rt-halo rt-halo-2" aria-hidden="true" />
      <Card
        style={{ width: '100%', maxWidth: 440 }}
        styles={{ body: { padding: 32 } }}
      >
        <Marque taille={30} />
        <h1
          className="rt-titre"
          style={{
            fontSize: 'calc(30px * var(--rt-titre-echelle))',
            margin: '0 0 6px',
          }}
        >
          Espace organisateur
        </h1>
        <Typography.Paragraph style={{ color: 'var(--rt-encre-70)' }}>
          Organisez votre événement d’une édition à l’autre.
        </Typography.Paragraph>

        {erreur && (
          <Alert
            type="error"
            showIcon
            title={erreur}
            style={{ marginBottom: 16 }}
          />
        )}

        {etape === 'adresse' ? (
          <Form
            layout="vertical"
            onFinish={() => void envoyerCode()}
            requiredMark={false}
          >
            <Form.Item
              label="Adresse mail"
              name="adresse"
              initialValue={adresse}
              rules={[
                {
                  required: true,
                  type: 'email',
                  message: 'Saisissez une adresse mail valide.',
                },
              ]}
            >
              <Input
                size="large"
                type="email"
                autoComplete="email"
                autoFocus
                onChange={e => setAdresse(e.target.value)}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={envoiEnCours}
            >
              Recevoir un code
            </Button>
            <Typography.Paragraph
              type="secondary"
              style={{ marginTop: 16, marginBottom: 0 }}
            >
              L’espace ne demande pas de mot de passe. Vous recevez un code par
              mail à chaque connexion.
            </Typography.Paragraph>
          </Form>
        ) : (
          <Form
            layout="vertical"
            onFinish={() => void valider(adresse, code)}
            requiredMark={false}
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title="Si cette adresse a un accès, un code vient de lui être envoyé. Il est valable 10 minutes."
            />
            <Form.Item label="Adresse mail">
              <Input
                size="large"
                type="email"
                autoComplete="email"
                value={adresse}
                onChange={e => setAdresse(e.target.value)}
              />
            </Form.Item>
            <Form.Item label="Code à 6 chiffres">
              <Input.OTP
                size="large"
                length={6}
                value={code}
                onChange={valeur => setCode(valeur)}
                formatter={valeur => valeur.replace(/\D/g, '')}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={envoiEnCours}
              disabled={code.length !== 6 || adresse.trim() === ''}
            >
              Se connecter
            </Button>
            <Button
              type="link"
              block
              style={{ marginTop: 8 }}
              onClick={() => {
                setEtape('adresse')
                setErreur(null)
                setCode('')
              }}
            >
              Changer d’adresse ou demander un nouveau code
            </Button>
          </Form>
        )}
      </Card>
    </main>
  )
}
