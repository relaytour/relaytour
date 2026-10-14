import { MailOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Alert, Col, Empty, Row, Skeleton, Tag } from 'antd'
import { Link } from 'react-router'

import { Avatar } from '../composants/Personne'
import { Section } from '../composants/Panneau'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import type { OrganigrammeQuery } from '../gql/graphql'
import { useActivite } from '../lib/activite'

// Organigramme de l'activité affichée (ADR 0035) : le contact de l'activité, ses
// admins, puis chaque périmètre avec son contact principal et ses référentes et
// référents de la période. Une personne en découverte ne lit que les admins et les
// contacts principaux. Le serveur ne renvoie une adresse personnelle qu'avec le
// réglage de l'activité et l'accord de la personne.

const ORGANIGRAMME = graphql(`
  query Organigramme {
    organigramme {
      edition {
        id
        nom
      }
      complet
      adresses
      contactActivite
      admins {
        personneId
        nom
        adresse
        moi
      }
      perimetres {
        perimetre {
          id
          slug
          nom
          groupe
          couleur
        }
        referents {
          personneId
          nom
          adresse
          contactPrincipal
          moi
        }
      }
    }
  }
`)

type Lu = OrganigrammeQuery['organigramme']
type Membre = Lu['admins'][number] & { contactPrincipal?: boolean }

function Ecrire({ adresse, nom }: { adresse: string; nom: string }) {
  return (
    <a
      href={`mailto:${adresse}`}
      aria-label={`Écrire à ${nom}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        overflowWrap: 'anywhere',
      }}
    >
      <MailOutlined aria-hidden />
      {adresse}
    </a>
  )
}

function Personne({ membre }: { membre: Membre }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <Avatar nom={membre.nom} taille={32} />
      <span
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minWidth: 0,
        }}
      >
        <span
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontWeight: 600 }}>{membre.nom}</span>
          {membre.moi && <span className="rt-compte">(vous)</span>}
          {membre.contactPrincipal && <Tag color="blue">Contact principal</Tag>}
        </span>
        {membre.adresse && <Ecrire adresse={membre.adresse} nom={membre.nom} />}
      </span>
    </li>
  )
}

const listeSimple = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
} as const

export default function Organigramme() {
  const { activite, lien, libelleGroupe } = useActivite()
  const { data, loading } = useQuery(ORGANIGRAMME)

  if (loading && data === undefined) return <Skeleton active />
  if (data === undefined) return null
  const o = data.organigramme

  const carte = (ligne: Lu['perimetres'][number]) => {
    const { perimetre, referents } = ligne
    return (
      <Col key={perimetre.id} xs={24} md={12} xl={8}>
        <div
          className="rt-verre"
          style={{
            boxSizing: 'border-box',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '16px 18px',
            borderRadius: 16,
            borderTop: `6px solid ${perimetre.couleur ?? 'var(--rt-primaire)'}`,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {perimetre.nom}
          </h3>
          {referents.length === 0 ? (
            <p className="rt-texte-secondaire" style={{ margin: 0 }}>
              {o.complet
                ? 'Aucune personne n’est affectée à ce périmètre pour la période.'
                : 'Aucun contact principal n’est désigné pour ce périmètre.'}
            </p>
          ) : (
            <ul style={listeSimple}>
              {referents.map(m => (
                <Personne key={m.personneId} membre={m} />
              ))}
            </ul>
          )}
        </div>
      </Col>
    )
  }

  const groupes = activite.groupes
    .map(g => ({
      groupe: g,
      lignes: o.perimetres.filter(p => p.perimetre.groupe === g.cle),
    }))
    .filter(g => g.lignes.length > 0)

  return (
    <>
      <Titre
        sousTitre={
          o.edition === null
            ? `L’équipe de ${activite.nom}.`
            : `L’équipe de ${o.edition.nom}, périmètre par périmètre.`
        }
      >
        Organigramme
      </Titre>
      {!o.complet && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Vous voyez les admins de l’activité et le contact principal de chaque périmètre. Les autres membres de l’équipe s’affichent quand un admin vous affecte à un périmètre."
        />
      )}
      {o.edition === null && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Aucune période n’est en préparation. Les référentes et référents s’affichent quand une période s’ouvre."
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Section titre="Contacter l’activité">
          <Row gutter={[12, 12]}>
            {o.contactActivite && (
              <Col xs={24} md={12} xl={8}>
                <div
                  className="rt-verre-teinte rt-panneau"
                  style={{ height: '100%', boxSizing: 'border-box' }}
                >
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                    Contact de l’activité
                  </h3>
                  <Ecrire adresse={o.contactActivite} nom={activite.nom} />
                  <p className="rt-note" style={{ margin: 0 }}>
                    Cette adresse partagée reçoit les questions sur l’équipe.
                  </p>
                </div>
              </Col>
            )}
            <Col xs={24} md={12} xl={o.contactActivite ? 16 : 24}>
              <div
                className="rt-verre rt-panneau"
                style={{ height: '100%', boxSizing: 'border-box' }}
              >
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  Admins de l’activité
                </h3>
                {o.admins.length === 0 ? (
                  <p className="rt-texte-secondaire" style={{ margin: 0 }}>
                    L’activité est gérée par les admins de l’organisation.
                  </p>
                ) : (
                  <ul style={listeSimple}>
                    {o.admins.map(m => (
                      <Personne key={m.personneId} membre={m} />
                    ))}
                  </ul>
                )}
              </div>
            </Col>
          </Row>
        </Section>
        <Section titre="Les périmètres" compte={o.perimetres.length}>
          {groupes.length === 0 ? (
            <Empty description="Cette activité n’a encore aucun périmètre." />
          ) : (
            groupes.map(({ groupe, lignes }) => (
              <section key={groupe.cle} style={{ marginBottom: 12 }}>
                <h3 className="rt-libelle" style={{ margin: '4px 0 10px' }}>
                  {libelleGroupe(groupe.cle, true)}
                </h3>
                <Row gutter={[12, 12]}>{lignes.map(carte)}</Row>
              </section>
            ))
          )}
        </Section>
        {o.complet && o.adresses !== 'AUCUNE' && (
          <p className="rt-note" style={{ margin: 0 }}>
            Une adresse s’affiche avec l’accord de chaque personne. Vous réglez
            le vôtre dans les <Link to={lien('/preferences')}>préférences</Link>
            .
          </p>
        )}
      </div>
    </>
  )
}
