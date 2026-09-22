import { useMutation } from '@apollo/client/react'

import { graphql } from '../gql'
import type { FormatMedia } from '../gql/graphql'

// Images d'identité (ADR 0009) : un logo PNG, obligatoire parce que les mails
// n'affichent pas le SVG ; un logo SVG facultatif, net à toutes les tailles ; un
// favicon PNG. Le serveur vérifie le format, le poids et l'absence de script.

const TELEVERSER = graphql(`
  mutation TeleverserMedia($format: FormatMedia!, $donnees: String!) {
    televerserMedia(format: $format, donnees: $donnees) {
      empreinte
      url
    }
  }
`)

export interface Image {
  empreinte: string
  url: string
}

/** L'adresse publique d'une image enregistrée, depuis son empreinte. */
export function urlImage(
  empreinte: string | null | undefined,
  format: 'png' | 'svg'
): string | null {
  return empreinte ? `/medias/${empreinte}.${format}` : null
}

function enBase64(fichier: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader()
    lecteur.onload = () => {
      const resultat = String(lecteur.result)
      resoudre(resultat.slice(resultat.indexOf(',') + 1))
    }
    lecteur.onerror = () =>
      rejeter(new Error('Le fichier ne peut pas être lu.'))
    lecteur.readAsDataURL(fichier)
  })
}

/** Téléverse une image et renvoie son empreinte et son adresse. */
export function useTeleverserImage(): [
  (fichier: File, format: FormatMedia) => Promise<Image>,
  boolean,
] {
  const [televerser, { loading }] = useMutation(TELEVERSER)
  return [
    async (fichier, format) => {
      const r = await televerser({
        variables: { format, donnees: await enBase64(fichier) },
      })
      if (!r.data) throw new Error('Le téléversement a échoué.')
      return r.data.televerserMedia
    },
    loading,
  ]
}
