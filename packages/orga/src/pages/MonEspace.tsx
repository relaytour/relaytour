import { ArrowRightOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { Button, Empty, Skeleton } from 'antd'
import { Link, useNavigate } from 'react-router'

import Avancement from '../composants/Avancement'
import Contribution from '../composants/Contribution'
import { DeuxColonnes, Panneau, Section } from '../composants/Panneau'
import TacheCarte from '../composants/TacheCarte'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import { dateCourte } from '../lib/erreurs'
import { prenom } from '../lib/personnes'
import { EDITION_COURANTE, MOI } from '../lib/requetes'
import { useActivite } from '../lib/activite'

const MES_TACHES = graphql(`
  query MesTaches($editionId: ID!) {
    moi {
      id
      affectations(editionId: $editionId) {
        id
        perimetre {
          id
          slug
          nom
          groupe
          couleur
          referents(editionId: $editionId) {
            id
            nom
          }
          avancement(editionId: $editionId) {
            total
            faites
            abandonnees
            enRetard
            sansPersonne
          }
        }
      }
    }
    mesTaches(editionId: $editionId) {
      ...TacheChamps
    }
    tachesAPrendre(editionId: $editionId) {
      ...TacheChamps
    }
  }
`)

const pluriel = (n: number, un: string, plusieurs: string) =>
  `${n} ${n > 1 ? plusieurs : un}`

export default function MonEspace() {
  const { lien, periode, libelleGroupe } = useActivite()
  const navigate = useNavigate()
  const { data: session } = useQuery(MOI)
  const { data: courante, loading: chargementEdition } =
    useQuery(EDITION_COURANTE)
  const edition = courante?.editionCourante
  const { data, loading } = useQuery(MES_TACHES, {
    variables: { editionId: edition?.id ?? '' },
    skip: !edition,
  })
  const moiId = session?.moi?.id ?? ''
  const estAdmin = session?.moi?.estAdmin ?? false
  const affectations = data?.moi?.affectations ?? []
  const mesTaches = data?.mesTaches ?? []
  const aPrendre = data?.tachesAPrendre ?? []
  const enRetard = mesTaches.filter(t => t.enRetard).length
  const referentsDe = (perimetreId: string) =>
    affectations.find(a => a.perimetre.id === perimetreId)?.perimetre
      .referents ?? []

  const sousTitre = edition
    ? `${edition.nom}, du ${dateCourte(edition.debut)} au ${dateCourte(edition.fin)}.`
    : chargementEdition
      ? ' '
      : `${periode.Aucune} n’est en préparation.`

  return (
    <>
      <Titre
        sousTitre={
          data && edition
            ? `${sousTitre} ${pluriel(mesTaches.length, 'tâche ouverte vous est assignée', 'tâches ouvertes vous sont assignées')}.`
            : sousTitre
        }
        actions={
          edition && (
            <Button
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              onClick={() => navigate(lien('/retroplanning'))}
            >
              Voir le rétroplanning
            </Button>
          )
        }
      >
        Bonjour {prenom(session?.moi?.nom)}
      </Titre>

      {loading || chargementEdition ? (
        <Skeleton active />
      ) : !edition ? null : (
        <DeuxColonnes
          cote={
            <>
              <Panneau
                titre="Vos périmètres"
                extra={<span className="rt-compte">{edition.annee}</span>}
              >
                {affectations.length === 0 ? (
                  <p className="rt-texte-secondaire">
                    Vous n’êtes affecté·e à aucun périmètre pour {periode.cette}
                    . Les admins gèrent les affectations.
                  </p>
                ) : (
                  affectations.map(({ id, perimetre }) => (
                    <Link
                      key={id}
                      to={lien(`/perimetres/${perimetre.slug}`)}
                      className="rt-bloc-lien"
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 9,
                            fontSize: 15,
                            fontWeight: 600,
                          }}
                        >
                          <span
                            className="rt-point"
                            style={{
                              background:
                                perimetre.couleur ?? 'var(--rt-primaire)',
                            }}
                          />
                          {perimetre.nom}
                        </span>
                        <span className="rt-libelle">
                          {libelleGroupe(perimetre.groupe)}
                        </span>
                      </span>
                      <Avancement
                        avancement={perimetre.avancement}
                        couleur={perimetre.couleur ?? undefined}
                        compact
                      />
                    </Link>
                  ))
                )}
              </Panneau>
              <Contribution
                editionId={edition.id}
                nomEdition={String(edition.annee)}
              />
            </>
          }
        >
          <Section
            titre="Vos tâches"
            compte={`${pluriel(mesTaches.length, 'ouverte', 'ouvertes')}${enRetard > 0 ? ` · ${enRetard} en retard` : ''}`}
          >
            {mesTaches.length === 0 ? (
              <div className="rt-verre rt-panneau">
                <Empty description="Aucune tâche ouverte ne vous est assignée." />
              </div>
            ) : (
              mesTaches.map(tache => (
                <TacheCarte
                  key={tache.id}
                  tache={tache}
                  moiId={moiId}
                  peutModifier
                  referents={referentsDe(tache.perimetre.id)}
                  estAdmin={estAdmin}
                  afficherPerimetre
                />
              ))
            )}
          </Section>

          {aPrendre.length > 0 && (
            <Section
              titre="À prendre dans vos périmètres"
              compte={pluriel(
                aPrendre.length,
                'tâche sans personne',
                'tâches sans personne'
              )}
            >
              {aPrendre.map(tache => (
                <TacheCarte
                  key={tache.id}
                  tache={tache}
                  moiId={moiId}
                  peutModifier
                  referents={referentsDe(tache.perimetre.id)}
                  estAdmin={estAdmin}
                  afficherPerimetre
                  teinte
                />
              ))}
            </Section>
          )}
        </DeuxColonnes>
      )}
    </>
  )
}
