import { useMutation, useQuery } from '@apollo/client/react'
import { App, Button, Popconfirm, Select, Space, Table, Tag } from 'antd'
import { useState } from 'react'

import { Section } from '../../composants/Panneau'
import Titre from '../../composants/Titre'
import { graphql } from '../../gql'
import type { Activite } from '../../lib/activite'
import { messageErreur } from '../../lib/erreurs'
import { ACTIVITES, DEFINIR_ADMIN_ACTIVITE } from '../../lib/requetes'
import { useSession } from '../../lib/session'

// Les admins de l'organisation (ADR 0019).
const ADMINS_ORGANISATION = graphql(`
  query AdminsOrganisation {
    adminsOrganisation {
      id
      nom
    }
  }
`)

// L'annuaire : un admin de l'organisation nomme parmi tous les membres.
const ANNUAIRE = graphql(`
  query AnnuaireAdmins {
    personnes {
      id
      nom
      estAdmin
    }
  }
`)

const EQUIPE = graphql(`
  query AdminsActivite($activiteId: ID!) {
    equipe(activiteId: $activiteId) {
      id
      nom
      activitesAdministrees
    }
  }
`)

// Le rôle d'organisation s'écrit avec le nom du compte, renvoyé tel quel.
const DEFINIR_ADMIN_ORGANISATION = graphql(`
  mutation DefinirAdminOrganisation(
    $id: ID!
    $nom: String!
    $estAdmin: Boolean!
  ) {
    modifierPersonne(id: $id, nom: $nom, estAdmin: $estAdmin) {
      id
      estAdmin
    }
  }
`)

interface Ligne {
  id: string
  nom: string
}

const RELIRE = {
  refetchQueries: ['AdminsOrganisation', 'AnnuaireAdmins', 'AdminsActivite'],
}

/** Une liste d'admins : les noms, un retrait par ligne et un champ pour nommer. */
function ListeAdmins({
  titre,
  aide,
  admins,
  candidats,
  chargement,
  vide,
  retirable,
  nommer,
  retirer,
}: {
  titre: string
  aide: string
  admins: Ligne[]
  /** Les personnes à nommer. */
  candidats: Ligne[]
  chargement: boolean
  vide: string
  retirable: (admin: Ligne) => boolean
  nommer: (personne: Ligne) => Promise<boolean>
  retirer: (admin: Ligne) => Promise<boolean>
}) {
  const moiId = useSession().moi.id
  const [choix, setChoix] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const choisie = candidats.find(p => p.id === choix)
  return (
    <Section titre={titre} compte={admins.length}>
      <p className="rt-texte-secondaire">{aide}</p>
      <Space wrap>
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="Personne"
          aria-label={`Personne à nommer : ${titre}`}
          style={{ minWidth: 240 }}
          value={choix}
          onChange={setChoix}
          notFoundContent="Aucune personne à nommer."
          options={candidats.map(p => ({ value: p.id, label: p.nom }))}
        />
        <Button
          type="primary"
          disabled={choisie === undefined}
          loading={enCours}
          onClick={async () => {
            if (choisie === undefined) return
            setEnCours(true)
            if (await nommer(choisie)) setChoix(null)
            setEnCours(false)
          }}
        >
          Nommer
        </Button>
      </Space>
      <Table<Ligne>
        rowKey="id"
        loading={chargement}
        dataSource={admins}
        pagination={false}
        locale={{ emptyText: vide }}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: 'Personne',
            render: (_, p) => (
              <Space>
                {p.nom}
                {p.id === moiId && <Tag>Vous</Tag>}
              </Space>
            ),
          },
          {
            title: '',
            key: 'actions',
            align: 'end',
            render: (_, p) =>
              retirable(p) ? (
                <Popconfirm
                  title={`Retirer ce rôle à ${p.nom} ?`}
                  description="La personne garde son compte, ses affectations et ses souhaits."
                  okText="Retirer"
                  cancelText="Annuler"
                  onConfirm={() => retirer(p)}
                >
                  <Button size="small" danger>
                    Retirer
                  </Button>
                </Popconfirm>
              ) : null,
          },
        ]}
      />
    </Section>
  )
}

/** Les admins d'une activité, lus dans son équipe. */
function AdminsActivite({
  activite,
  annuaire,
  executer,
}: {
  activite: Activite
  /** Tous les membres de l'organisation. */
  annuaire: Ligne[]
  executer: (action: () => Promise<unknown>, succes: string) => Promise<boolean>
}) {
  const { data, loading } = useQuery(EQUIPE, {
    variables: { activiteId: activite.id },
  })
  const [definir] = useMutation(DEFINIR_ADMIN_ACTIVITE, RELIRE)
  const equipe = data?.equipe ?? []
  const admins = equipe.filter(p =>
    p.activitesAdministrees.includes(activite.id)
  )
  const dejaAdmins = new Set(admins.map(p => p.id))
  const candidats = annuaire.filter(p => !dejaAdmins.has(p.id))
  const definirAdmin = (personne: Ligne, admin: boolean) =>
    executer(
      () =>
        definir({
          variables: {
            personneId: personne.id,
            activiteId: activite.id,
            admin,
          },
        }),
      admin
        ? `${personne.nom} administre ${activite.nom}.`
        : `${personne.nom} n’administre plus ${activite.nom}.`
    )
  return (
    <ListeAdmins
      titre={activite.nom}
      aide="Un admin d’activité gère ses périodes, ses périmètres, ses affectations et ses fiches. Il ne voit pas les autres activités. Il nomme les autres admins de son activité depuis l’écran Personnes."
      admins={admins}
      candidats={candidats}
      chargement={loading && !data}
      vide="Cette activité n’a aucun admin. Les admins de l’organisation la gèrent."
      retirable={() => true}
      nommer={p => definirAdmin(p, true)}
      retirer={p => definirAdmin(p, false)}
    />
  )
}

/**
 * Les admins de l'organisation, puis ceux de chaque activité (ADR 0019). L'écran
 * est réservé aux admins de l'organisation, qui nomment à tous les niveaux. Un admin
 * d'activité nomme ceux de son activité depuis l'écran « Personnes ».
 */
export default function Admins() {
  const { moi } = useSession()
  const { message } = App.useApp()
  const { data, loading } = useQuery(ADMINS_ORGANISATION)
  const { data: annuaire } = useQuery(ANNUAIRE)
  const { data: activites } = useQuery(ACTIVITES)
  const [definir] = useMutation(DEFINIR_ADMIN_ORGANISATION, RELIRE)

  const executer = async (action: () => Promise<unknown>, succes: string) => {
    try {
      await action()
      message.success(succes)
      return true
    } catch (e) {
      message.error(messageErreur(e))
      return false
    }
  }

  const definirAdmin = (personne: Ligne, estAdmin: boolean) =>
    executer(
      () =>
        definir({
          variables: { id: personne.id, nom: personne.nom, estAdmin },
        }),
      estAdmin
        ? `${personne.nom} administre l’organisation.`
        : `${personne.nom} n’administre plus l’organisation.`
    )
  const administrees = (activites?.activites ?? []).filter(
    a => a.estAdministree && !a.archive
  )

  return (
    <>
      <Titre sousTitre="Les admins de l’organisation, puis les admins de chaque activité. Vous nommez et retirez les uns et les autres.">
        Admins
      </Titre>
      <div className="rt-colonne" style={{ gap: 32 }}>
        <ListeAdmins
          titre="Organisation"
          aide="Un admin de l’organisation gère toutes les activités, les comptes et l’identité de l’organisation."
          admins={data?.adminsOrganisation ?? []}
          candidats={(annuaire?.personnes ?? []).filter(
            p => p.estAdmin !== true
          )}
          chargement={loading && !data}
          vide="Aucun admin."
          // Un admin ne retire pas ses propres droits : il ne pourrait plus les
          // rétablir.
          retirable={p => p.id !== moi.id}
          nommer={p => definirAdmin(p, true)}
          retirer={p => definirAdmin(p, false)}
        />
        {administrees.map(a => (
          <AdminsActivite
            key={a.id}
            activite={a}
            annuaire={annuaire?.personnes ?? []}
            executer={executer}
          />
        ))}
      </div>
    </>
  )
}
