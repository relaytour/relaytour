import { useApolloClient } from '@apollo/client/react'
import { colors, fonts } from '@relaytour/tokens'
import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import {
  adresseMemorisee,
  demanderCode,
  ErreurConnexion,
  lireCodeDuLien,
  seConnecter,
} from '../lib/connexion'

type Etape = 'adresse' | 'code'

// Le code du lien se lit une seule fois par chargement de page : la lecture efface
// le fragment de la barre d'adresse.
let codeDuLien: string | null | undefined
function codeDuLienUneFois(): string | null {
  if (codeDuLien === undefined) codeDuLien = lireCodeDuLien()
  return codeDuLien
}

export default function Connexion() {
  const navigate = useNavigate()
  const apollo = useApolloClient()
  const [etape, setEtape] = useState<Etape>(() =>
    codeDuLienUneFois() === null ? 'adresse' : 'code'
  )
  const [adresse, setAdresse] = useState(adresseMemorisee)
  const [code, setCode] = useState(() => codeDuLienUneFois() ?? '')
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

  // Lien reçu par mail : si l'adresse a été saisie dans cet onglet, la connexion est
  // immédiate ; sinon, la personne saisit son adresse et le code reste prérempli.
  useEffect(() => {
    if (lienTraite.current) return
    lienTraite.current = true
    const codeLu = codeDuLienUneFois()
    const memorisee = adresseMemorisee()
    if (codeLu !== null && memorisee !== '') {
      // Le lien du mail est une source externe : la connexion part au montage, une seule fois.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void valider(memorisee, codeLu)
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
        background: `linear-gradient(160deg, ${colors.marine} 0%, ${colors.indigo} 100%)`,
      }}
    >
      <Card
        style={{ width: '100%', maxWidth: 420 }}
        styles={{ body: { padding: 32 } }}
      >
        <h1
          style={{
            fontFamily: fonts.display,
            fontWeight: 400,
            fontSize: 48,
            lineHeight: 1,
            margin: '0 0 4px',
          }}
        >
          Espace organisateur
        </h1>
        <Typography.Paragraph style={{ fontWeight: 600, opacity: 0.8 }}>
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
