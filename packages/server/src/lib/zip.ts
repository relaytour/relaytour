import { crc32, deflateRawSync } from 'node:zlib'

// Archive zip minimale (compression « deflate »), sans dépendance : l'export du
// contenu d'une organisation se télécharge en un seul fichier (ADR 0009).

const DATE_DOS = ((2026 - 1980) << 9) | (1 << 5) | 1 // 1er janvier 2026, fixe : une archive reproductible.

/** Assemble une archive zip à partir de fichiers nommés par leur chemin relatif. */
export function archiveZip(fichiers: ReadonlyMap<string, Buffer>): Buffer {
  const locaux: Buffer[] = []
  const central: Buffer[] = []
  let decalage = 0
  for (const [chemin, donnees] of [...fichiers].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const nom = Buffer.from(chemin, 'utf8')
    const compresse = deflateRawSync(donnees)
    const somme = crc32(donnees)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version requise
    local.writeUInt16LE(0x0800, 6) // noms en UTF-8
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt16LE(0, 10) // heure
    local.writeUInt16LE(DATE_DOS, 12)
    local.writeUInt32LE(somme, 14)
    local.writeUInt32LE(compresse.length, 18)
    local.writeUInt32LE(donnees.length, 22)
    local.writeUInt16LE(nom.length, 26)
    local.writeUInt16LE(0, 28)
    locaux.push(local, nom, compresse)

    const entree = Buffer.alloc(46)
    entree.writeUInt32LE(0x02014b50, 0)
    entree.writeUInt16LE(20, 4)
    entree.writeUInt16LE(20, 6)
    entree.writeUInt16LE(0x0800, 8)
    entree.writeUInt16LE(8, 10)
    entree.writeUInt16LE(0, 12)
    entree.writeUInt16LE(DATE_DOS, 14)
    entree.writeUInt32LE(somme, 16)
    entree.writeUInt32LE(compresse.length, 20)
    entree.writeUInt32LE(donnees.length, 24)
    entree.writeUInt16LE(nom.length, 28)
    entree.writeUInt32LE(decalage, 42)
    central.push(entree, nom)
    decalage += local.length + nom.length + compresse.length
  }
  const tailleCentral = central.reduce((n, b) => n + b.length, 0)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(fichiers.size, 8)
  fin.writeUInt16LE(fichiers.size, 10)
  fin.writeUInt32LE(tailleCentral, 12)
  fin.writeUInt32LE(decalage, 16)
  return Buffer.concat([...locaux, ...central, fin])
}
