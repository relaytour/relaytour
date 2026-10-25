import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib'

import { i18n } from './langue.ts'

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

/** Bornes d'une archive déposée (ADR 0049). */
export interface LimitesArchive {
  /** Taille de l'archive, en octets. */
  taille: number
  /** Taille totale une fois décompressée, en octets. */
  decompressee: number
  fichiers: number
}

export class ErreurArchive extends Error {}

/** Une taille en mégaoctets, arrondie, pour les messages. */
const mo = (octets: number) => Math.round(octets / (1024 * 1024))

/** Un chemin d'archive sûr : relatif, sans « .. », sans barre oblique inverse. */
function cheminSur(nom: string): boolean {
  if (nom === '' || nom.startsWith('/') || /^[A-Za-z]:/.test(nom)) return false
  if (nom.includes('\\') || nom.includes('\0')) return false
  return nom.split('/').every(s => s !== '' && s !== '..' && s !== '.')
}

/** Les fichiers ajoutés par les systèmes d'exploitation, ignorés. */
function fichierSysteme(nom: string): boolean {
  const base = nom.split('/').pop() ?? ''
  return (
    nom.startsWith('__MACOSX/') ||
    base === '.DS_Store' ||
    base === 'Thumbs.db' ||
    base.startsWith('._')
  )
}

/**
 * Lit une archive zip en mémoire : les fichiers par chemin relatif, sans les
 * dossiers ni les fichiers système. Refuse le zip64, le chiffrement, une méthode
 * autre que « stored » ou « deflate », un chemin qui sort de l'archive et toute
 * archive au-delà de ses bornes. La décompression s'arrête à la taille restante :
 * une archive piégée n'occupe jamais plus que la borne.
 */
export function lireArchiveZip(
  archive: Buffer,
  limites: LimitesArchive
): Map<string, Buffer> {
  if (archive.length > limites.taille) {
    throw new ErreurArchive(
      i18n._('L’archive dépasse {mo} Mo.', { mo: mo(limites.taille) })
    )
  }
  // Fin du répertoire central : 22 octets, suivis d'un commentaire de 64 Ko au plus.
  let fin = -1
  const plancher = Math.max(0, archive.length - 22 - 0xffff)
  for (let i = archive.length - 22; i >= plancher; i--) {
    if (archive.readUInt32LE(i) === 0x06054b50) {
      fin = i
      break
    }
  }
  if (fin < 0)
    throw new ErreurArchive(
      i18n._('Le fichier n’est pas une archive zip lisible.')
    )
  const nombre = archive.readUInt16LE(fin + 10)
  const tailleCentral = archive.readUInt32LE(fin + 12)
  const debutCentral = archive.readUInt32LE(fin + 16)
  if (
    nombre === 0xffff ||
    tailleCentral === 0xffffffff ||
    debutCentral === 0xffffffff
  ) {
    throw new ErreurArchive(i18n._('Le format zip64 n’est pas pris en charge.'))
  }
  if (nombre > limites.fichiers) {
    throw new ErreurArchive(
      i18n._('L’archive contient plus de {nombre} fichiers.', {
        nombre: limites.fichiers,
      })
    )
  }
  if (debutCentral + tailleCentral > fin) {
    throw new ErreurArchive(
      i18n._('Le fichier n’est pas une archive zip lisible.')
    )
  }

  const fichiers = new Map<string, Buffer>()
  let restant = limites.decompressee
  let position = debutCentral
  for (let n = 0; n < nombre; n++) {
    if (position + 46 > fin || archive.readUInt32LE(position) !== 0x02014b50) {
      throw new ErreurArchive(
        i18n._('Le fichier n’est pas une archive zip lisible.')
      )
    }
    const drapeaux = archive.readUInt16LE(position + 8)
    const methode = archive.readUInt16LE(position + 10)
    const somme = archive.readUInt32LE(position + 16)
    const compressee = archive.readUInt32LE(position + 20)
    const decompressee = archive.readUInt32LE(position + 24)
    const longueurNom = archive.readUInt16LE(position + 28)
    const longueurExtra = archive.readUInt16LE(position + 30)
    const longueurCommentaire = archive.readUInt16LE(position + 32)
    const local = archive.readUInt32LE(position + 42)
    const nom = archive
      .subarray(position + 46, position + 46 + longueurNom)
      .toString((drapeaux & 0x0800) !== 0 ? 'utf8' : 'latin1')
    position += 46 + longueurNom + longueurExtra + longueurCommentaire

    if (nom.endsWith('/') || fichierSysteme(nom)) continue
    if (!cheminSur(nom))
      throw new ErreurArchive(
        i18n._('Chemin refusé dans l’archive : {nom}', { nom })
      )
    if ((drapeaux & 0x0001) !== 0) {
      throw new ErreurArchive(
        i18n._('Une archive chiffrée n’est pas prise en charge.')
      )
    }
    if (
      compressee === 0xffffffff ||
      decompressee === 0xffffffff ||
      local === 0xffffffff
    ) {
      throw new ErreurArchive(
        i18n._('Le format zip64 n’est pas pris en charge.')
      )
    }
    if (fichiers.has(nom))
      throw new ErreurArchive(
        i18n._('Fichier en double dans l’archive : {nom}', { nom })
      )
    if (decompressee > restant) {
      throw new ErreurArchive(
        i18n._('L’archive dépasse {mo} Mo une fois décompressée.', {
          mo: mo(limites.decompressee),
        })
      )
    }
    if (local + 30 > fin || archive.readUInt32LE(local) !== 0x04034b50) {
      throw new ErreurArchive(
        i18n._('Le fichier n’est pas une archive zip lisible.')
      )
    }
    const debut =
      local +
      30 +
      archive.readUInt16LE(local + 26) +
      archive.readUInt16LE(local + 28)
    if (debut + compressee > fin) {
      throw new ErreurArchive(
        i18n._('Le fichier n’est pas une archive zip lisible.')
      )
    }
    const brut = archive.subarray(debut, debut + compressee)
    let donnees: Buffer
    if (methode === 0) {
      donnees = Buffer.from(brut)
    } else if (methode === 8) {
      try {
        donnees = inflateRawSync(brut, {
          maxOutputLength: Math.max(1, restant),
        })
      } catch {
        throw new ErreurArchive(
          i18n._('Fichier illisible ou trop lourd dans l’archive : {nom}', {
            nom,
          })
        )
      }
    } else {
      throw new ErreurArchive(
        i18n._('Méthode de compression non prise en charge : {nom}', { nom })
      )
    }
    if (donnees.length !== decompressee || crc32(donnees) !== somme) {
      throw new ErreurArchive(
        i18n._('Fichier abîmé dans l’archive : {nom}', { nom })
      )
    }
    restant -= donnees.length
    fichiers.set(nom, donnees)
  }
  return fichiers
}

/**
 * Retire le dossier englobant quand tous les fichiers d'une archive s'y trouvent
 * (« contenu/organisation.yaml » devient « organisation.yaml ») : une archive faite
 * à la main depuis un dossier le contient souvent.
 */
export function sansDossierEnglobant(
  fichiers: ReadonlyMap<string, Buffer>
): Map<string, Buffer> {
  const chemins = [...fichiers.keys()]
  const premier = chemins[0]?.split('/')[0]
  if (
    premier === undefined ||
    !chemins.every(c => c.startsWith(`${premier}/`))
  ) {
    return new Map(fichiers)
  }
  return new Map(
    [...fichiers].map(([c, d]) => [c.slice(premier.length + 1), d])
  )
}
