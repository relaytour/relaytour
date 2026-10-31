import { ArrowRightOutlined } from '@ant-design/icons'
import { useQuery } from '@apollo/client/react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Empty, Skeleton } from 'antd'
import { Link, useNavigate } from 'react-router'

import Avancement from '../composants/Avancement'
import Contribution from '../composants/Contribution'
import { DeuxColonnes, Groupe, Panneau } from '../composants/Panneau'
import PremiersPas from '../composants/PremiersPas'
import TacheCarte from '../composants/TacheCarte'
import Titre from '../composants/Titre'
import { graphql } from '../gql'
import { dateCourte } from '../lib/erreurs'
import { useGroupesReplies } from '../lib/groupes-replies'
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

export default function MonEspace() {
  const { t } = useLingui()
  const { lien, periode, libelleGroupe, gere } = useActivite()
  const navigate = useNavigate()
  const replies = useGroupesReplies('mon-espace')
  const { data: session } = useQuery(MOI)
  const { data: courante, loading: chargementEdition } =
    useQuery(EDITION_COURANTE)
  const edition = courante?.editionCourante
  const { data, loading } = useQuery(MES_TACHES, {
    variables: { editionId: edition?.id ?? '' },
    skip: !edition,
  })
  const moiId = session?.moi?.id ?? ''
  const prenomPersonne = prenom(session?.moi?.nom)
  // Les admins de l'activité gèrent les assignations de toute personne.
  const estAdmin = gere
  const affectations = data?.moi?.affectations ?? []
  const mesTaches = data?.mesTaches ?? []
  const aPrendre = data?.tachesAPrendre ?? []
  const enRetard = mesTaches.filter(tache => tache.enRetard).length
  const referentsDe = (perimetreId: string) =>
    affectations.find(a => a.perimetre.id === perimetreId)?.perimetre
      .referents ?? []

  const nombreMesTaches = mesTaches.length
  const nombreAPrendre = aPrendre.length
  const cettePeriode = periode.cette
  const laPeriode = periode.la
  const aucunePeriode = periode.Aucune
  const nomEdition = edition?.nom ?? ''
  const debutEdition = edition ? dateCourte(edition.debut) : ''
  const finEdition = edition ? dateCourte(edition.fin) : ''

  const sousTitre = edition
    ? t`${nomEdition}, du ${debutEdition} au ${finEdition}.`
    : chargementEdition
      ? ' '
      : t`${aucunePeriode} n’est en préparation.`

  return (
    <>
      <Titre
        sousTitre={
          data && edition
            ? t`${nomEdition}, du ${debutEdition} au ${finEdition}. ${plural(
                nombreMesTaches,
                {
                  one: '# tâche ouverte vous est assignée',
                  other: '# tâches ouvertes vous sont assignées',
                }
              )}.`
            : sousTitre
        }
        actions={
          edition && (
            <Button
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              onClick={() => navigate(lien('/retroplanning'))}
            >
              <Trans>Voir le rétroplanning</Trans>
            </Button>
          )
        }
      >
        <Trans>Bonjour {prenomPersonne}</Trans>
      </Titre>

      {gere && (
        <div style={{ marginBottom: 16 }}>
          <PremiersPas />
        </div>
      )}

      {(loading && !data) || (chargementEdition && !courante) ? (
        <Skeleton active />
      ) : !edition ? (
        !gere && (
          <Panneau etiquette={t`Préparation`}>
            <p className="rt-texte-secondaire" style={{ margin: 0 }}>
              {t`Les admins de l’activité préparent ${laPeriode} à venir.`}
            </p>
          </Panneau>
        )
      ) : (
        <DeuxColonnes
          cote={
            <>
              <Panneau
                titre={t`Vos périmètres`}
                extra={<span className="rt-compte">{edition.annee}</span>}
              >
                {affectations.length === 0 ? (
                  <p className="rt-texte-secondaire">
                    <Trans>
                      Vous n’êtes affecté·e à aucun périmètre pour{' '}
                      {cettePeriode}. Les admins gèrent les affectations. Dans{' '}
                      <Link to={lien('/perimetres')}>Tous les périmètres</Link>,
                      vous découvrez les périmètres et formulez vos souhaits.
                    </Trans>
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
              {affectations.length > 0 && (
                <Panneau titre={t`Charge de l’équipe`}>
                  <p className="rt-texte-secondaire" style={{ margin: 0 }}>
                    <Trans>
                      Comparez les tâches ouvertes et les places au programme de
                      chaque personne avant de répartir le travail.
                    </Trans>
                  </p>
                  <Link to={lien(`/charge?edition=${edition.id}`)}>
                    <Trans>Voir la charge de l’équipe</Trans>
                  </Link>
                </Panneau>
              )}
            </>
          }
        >
          <Groupe
            titre={t`Vos tâches`}
            nom={t`Vos tâches`}
            replie={replies.estReplie('mes-taches')}
            onBasculer={() => replies.basculer('mes-taches')}
            compte={
              enRetard > 0
                ? t`${plural(nombreMesTaches, { one: '# ouverte', other: '# ouvertes' })} · ${enRetard} en retard`
                : t`${plural(nombreMesTaches, { one: '# ouverte', other: '# ouvertes' })}`
            }
          >
            {mesTaches.length === 0 ? (
              <div className="rt-verre rt-panneau">
                <Empty
                  description={t`Aucune tâche ouverte ne vous est assignée.`}
                />
              </div>
            ) : (
              mesTaches.map(tache => (
                <TacheCarte
                  key={tache.id}
                  tache={tache}
                  moiId={moiId}
                  peutModifier={tache.peutModifier}
                  referents={referentsDe(tache.perimetre.id)}
                  estAdmin={estAdmin}
                  editionId={edition?.id}
                  afficherPerimetre
                />
              ))
            )}
          </Groupe>

          {aPrendre.length > 0 && (
            <Groupe
              titre={t`À prendre dans vos périmètres`}
              nom={t`À prendre dans vos périmètres`}
              replie={replies.estReplie('a-prendre')}
              onBasculer={() => replies.basculer('a-prendre')}
              compte={t`${plural(nombreAPrendre, {
                one: '# tâche sans personne',
                other: '# tâches sans personne',
              })}`}
            >
              {aPrendre.map(tache => (
                <TacheCarte
                  key={tache.id}
                  tache={tache}
                  moiId={moiId}
                  peutModifier={tache.peutModifier}
                  referents={referentsDe(tache.perimetre.id)}
                  estAdmin={estAdmin}
                  editionId={edition?.id}
                  afficherPerimetre
                  teinte
                />
              ))}
            </Groupe>
          )}
        </DeuxColonnes>
      )}
    </>
  )
}
