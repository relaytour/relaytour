import { deflateSync } from 'node:zlib'

// Images de test, fabriquées à la volée : aucun fichier binaire dans le dépôt.

/** Un PNG valide d'un pixel, d'une couleur donnée. */
export function pngMinimal(rouge = 255): Buffer {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])
  const bloc = (type: string, donnees: Buffer) => {
    const longueur = Buffer.alloc(4)
    longueur.writeUInt32BE(donnees.length)
    return Buffer.concat([
      longueur,
      Buffer.from(type),
      donnees,
      Buffer.alloc(4),
    ])
  }
  const entete = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])
  return Buffer.concat([
    signature,
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(Buffer.from([0, rouge, 255, 255]))),
    bloc('IEND', Buffer.alloc(0)),
  ])
}

export const SVG_EXEMPLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#123456"/></svg>'
