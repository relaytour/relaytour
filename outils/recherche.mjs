// recherche : prépare la recherche des modes d'emploi du site.
//
// La recherche par défaut est un index Pagefind, par les mots. Le script prépare
// aussi la recherche par le sens, qu'une personne active sur un ordinateur : il
// découpe chaque mode d'emploi (français et anglais) en passages, un par partie
// et par écran, puis calcule le vecteur de chaque passage avec le modèle
// multilingual-e5-small. Il écrit dans site/recherche/, ignoré par Git :
//   - pagefind/ : l'index Pagefind, une partie par langue ;
//   - fr.json et en.json : les passages et leurs vecteurs ;
//   - modeles/ : le modèle, téléchargé une fois depuis Hugging Face à une
//     révision fixée, et vérifié par son empreinte SHA-256 ;
//   - lib/ : transformers.js et le moteur WebAssembly d'ONNX Runtime.
// Le navigateur des visiteurs charge ainsi tout depuis le site, sans tiers.
// Le workflow pages.yml lance ce script avant de publier le site.
//
//   node outils/recherche.mjs
import { createHash } from 'node:crypto'
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import { env, pipeline } from '@huggingface/transformers'
import * as pagefind from 'pagefind'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = join(RACINE, 'site')
const SORTIE = join(SITE, 'recherche')
const MODULES = join(RACINE, 'node_modules')

// Modèle multilingue sous licence MIT (intfloat/multilingual-e5-small, converti
// pour ONNX). Une nouvelle révision se relit et change les empreintes.
export const MODELE = 'Xenova/multilingual-e5-small'
const REVISION = '761b726dd34fb83930e26aab4e9ac3899aa1fa78'
const FICHIERS_MODELE = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/model_quantized.onnx',
]

// transformers.js et le moteur WebAssembly d'ONNX Runtime, dans sa version sans
// WebGPU (14 Mo au lieu de 27).
const BIBLIOTHEQUES = [
  ['@huggingface/transformers/dist/transformers.min.js', 'transformers.min.js'],
  [
    'onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.mjs',
  ],
  [
    'onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.wasm',
  ],
]

const LANGUES = [
  {
    code: 'fr',
    dossier: join(SITE, 'modes-d-emploi'),
    url: '/modes-d-emploi/',
  },
  {
    code: 'en',
    dossier: join(SITE, 'en', 'modes-d-emploi'),
    url: '/en/modes-d-emploi/',
  },
]

// Un passage garde 120 mots au plus : le modèle lit 512 jetons, et un passage
// court donne un vecteur plus précis.
const MOTS_PAR_PASSAGE = 120

const empreinte = async chemin =>
  createHash('sha256')
    .update(await readFile(chemin))
    .digest('hex')

const existe = async chemin => {
  try {
    await stat(chemin)
    return true
  } catch {
    return false
  }
}

// Télécharge le modèle à sa révision fixée, sauf s'il est déjà là. Les empreintes
// attendues viennent de Hugging Face, qui les publie pour chaque fichier.
async function preparerModele() {
  const dossier = join(SORTIE, 'modeles', MODELE)
  const arbre = await fetch(
    `https://huggingface.co/api/models/${MODELE}/tree/${REVISION}?recursive=true`
  ).then(reponse => (reponse.ok ? reponse.json() : null))
  for (const fichier of FICHIERS_MODELE) {
    const chemin = join(dossier, fichier)
    const attendue = arbre?.find(entree => entree.path === fichier)?.lfs?.oid
    if (await existe(chemin)) {
      if (!attendue || (await empreinte(chemin)) === attendue) continue
    }
    const adresse = `https://huggingface.co/${MODELE}/resolve/${REVISION}/${fichier}`
    const reponse = await fetch(adresse)
    if (!reponse.ok) throw new Error(`✖ ${adresse} : ${reponse.status}`)
    await mkdir(dirname(chemin), { recursive: true })
    await writeFile(chemin, Buffer.from(await reponse.arrayBuffer()))
    if (attendue && (await empreinte(chemin)) !== attendue) {
      throw new Error(`✖ ${fichier} : empreinte inattendue`)
    }
  }
  return dossier
}

async function copierBibliotheques() {
  const dossier = join(SORTIE, 'lib')
  await mkdir(dossier, { recursive: true })
  for (const [source, cible] of BIBLIOTHEQUES) {
    await copyFile(join(MODULES, source), join(dossier, cible))
  }
}

const espaces = texte => texte.replace(/\s+/g, ' ').trim()

// Le texte lisible d'un élément, sans les captures ni les exemples rendus.
function texteDe($, element) {
  const copie = $(element).clone()
  // Les numéros des étapes (« 1 », « 2 ») ne portent aucun sens et collent au texte.
  copie
    .find(
      'img, picture, svg, script, style, .bascule, .rendu-markdown, .gestes .libelle'
    )
    .remove()
  copie.find('p, li, h3, h4, dt, dd, div, tr, td, th, span.route').after(' \n')
  return espaces(copie.text())
}

// Découpe un texte en morceaux de MOTS_PAR_PASSAGE mots au plus, à la fin d'une
// phrase quand c'est possible.
function decouper(texte) {
  const phrases = texte.match(/[^.!?:]+[.!?:]*\s*/g) ?? [texte]
  const morceaux = []
  let courant = []
  for (const phrase of phrases) {
    const mots = phrase.trim().split(/\s+/).filter(Boolean)
    if (courant.length > 0 && courant.length + mots.length > MOTS_PAR_PASSAGE) {
      morceaux.push(courant.join(' '))
      courant = []
    }
    courant.push(...mots)
    while (courant.length > MOTS_PAR_PASSAGE) {
      morceaux.push(courant.splice(0, MOTS_PAR_PASSAGE).join(' '))
    }
  }
  if (courant.length > 0) morceaux.push(courant.join(' '))
  return morceaux
}

// Un lien vers un titre sans identifiant pointe sur sa partie, avec un fragment
// de texte qui fait défiler la page jusqu'au titre.
const fragmentTexte = titre =>
  `:~:text=${encodeURIComponent(titre).replace(/-/g, '%2D')}`

function extrairePage(fichier, html) {
  const $ = cheerio.load(html)
  const page = espaces($('h1').first().text())
  const passages = []
  const ajouter = (partie, lien, texte) => {
    for (const morceau of decouper(texte)) {
      // Une partie qui ne porte qu'un titre et des liens n'apprend rien au lecteur.
      if (morceau.split(' ').length >= 12)
        passages.push({ page, partie, lien, texte: morceau })
    }
  }

  // La page d'accueil des modes d'emploi : une carte par mode d'emploi.
  if (fichier === 'index.html') {
    $('a.lien-guide').each((_, carte) => {
      const titre = espaces($(carte).find('h3').text())
      ajouter(titre, $(carte).attr('href'), texteDe($, carte))
    })
    return passages
  }

  ajouter(page, fichier, texteDe($, $('header.tete').first()))

  $('main.page > section').each((_, section) => {
    const h2 = $(section).find('.entete h2[id]').first()
    if (h2.length === 0) return
    const partie = espaces(h2.text())
    const ancre = `${fichier}#${h2.attr('id')}`
    ajouter(partie, ancre, texteDe($, $(section).find('.entete').first()))

    $(section)
      .find('h3')
      .filter((_, h3) => $(h3).closest('.rendu-markdown, a').length === 0)
      .each((_, h3) => {
        const titre = espaces($(h3).text())
        const carte = $(h3).closest('article')
        const conteneur = carte.length > 0 ? carte : $(h3).parent()
        const id = carte.attr('id') ?? $(h3).attr('id')
        const lien = id ? `${fichier}#${id}` : `${ancre}${fragmentTexte(titre)}`
        ajouter(`${partie} · ${titre}`, lien, texteDe($, conteneur))
      })
  })
  return passages
}

// Un vecteur normalisé tient sur 384 octets : chaque composante passe en entier
// signé sur 8 bits. Le produit scalaire de deux vecteurs ainsi réduits reste
// proche de leur similarité cosinus.
function quantifier(vecteurs) {
  const octets = new Int8Array(vecteurs.length * vecteurs[0].length)
  vecteurs.forEach((vecteur, i) => {
    vecteur.forEach((valeur, j) => {
      octets[i * vecteur.length + j] = Math.max(
        -127,
        Math.min(127, Math.round(valeur * 127))
      )
    })
  })
  return Buffer.from(octets.buffer).toString('base64')
}

async function indexer(extraire, langue) {
  const fichiers = (await readdir(langue.dossier))
    .filter(nom => nom.endsWith('.html'))
    .sort()
  const passages = []
  for (const fichier of fichiers) {
    passages.push(
      ...extrairePage(
        fichier,
        await readFile(join(langue.dossier, fichier), 'utf8')
      )
    )
  }
  // Le modèle e5 attend le préfixe « passage: » devant un texte à retrouver.
  const entrees = passages.map(
    p => `passage: ${p.page} · ${p.partie}. ${p.texte}`
  )
  const vecteurs = []
  for (let i = 0; i < entrees.length; i += 16) {
    const sortie = await extraire(entrees.slice(i, i + 16), {
      pooling: 'mean',
      normalize: true,
    })
    vecteurs.push(...sortie.tolist())
  }
  const index = {
    modele: MODELE,
    revision: REVISION,
    dimension: vecteurs[0].length,
    passages: passages.map(({ page, partie, lien, texte }) => ({
      page,
      partie,
      lien,
      texte,
    })),
    vecteurs: quantifier(vecteurs),
  }
  await writeFile(join(SORTIE, `${langue.code}.json`), JSON.stringify(index))
  return passages.length
}

// Pagefind indexe le contenu principal de chaque mode d'emploi, sans la barre,
// le pied de page ni les boutons. Un titre d'écran reçoit l'identifiant de sa
// carte : Pagefind en fait un résultat qui mène à cet écran.
function pourPagefind(html) {
  const $ = cheerio.load(html)
  $('nav, footer, script, .bascule, img, picture, svg, form').remove()
  $('main').attr('data-pagefind-body', '')
  $('h1').first().attr('data-pagefind-meta', 'title')
  $('article[id]').each((_, carte) => {
    const titre = $(carte).find('h3').first()
    if (titre.length > 0 && !titre.attr('id')) {
      titre.attr('id', $(carte).attr('id'))
      $(carte).removeAttr('id')
    }
  })
  return $.html()
}

async function indexerPagefind() {
  const { index, errors } = await pagefind.createIndex({})
  if (!index) throw new Error(`✖ Pagefind : ${errors.join(', ')}`)
  let nombre = 0
  for (const langue of LANGUES) {
    const fichiers = (await readdir(langue.dossier)).filter(nom =>
      nom.endsWith('.html')
    )
    for (const fichier of fichiers) {
      const html = await readFile(join(langue.dossier, fichier), 'utf8')
      const reponse = await index.addHTMLFile({
        url: `${langue.url}${fichier === 'index.html' ? '' : fichier}`,
        content: pourPagefind(html),
      })
      if (reponse.errors.length > 0) {
        throw new Error(`✖ Pagefind, ${fichier} : ${reponse.errors.join(', ')}`)
      }
      nombre++
    }
  }
  await index.writeFiles({ outputPath: join(SORTIE, 'pagefind') })
  await pagefind.close()
  return nombre
}

await mkdir(SORTIE, { recursive: true })
console.log(`✔ site/recherche/pagefind : ${await indexerPagefind()} pages`)
const dossierModeles = await preparerModele()
await copierBibliotheques()

env.allowRemoteModels = false
env.localModelPath = join(SORTIE, 'modeles')
const extraire = await pipeline('feature-extraction', MODELE, { dtype: 'q8' })
for (const langue of LANGUES) {
  const nombre = await indexer(extraire, langue)
  console.log(`✔ site/recherche/${langue.code}.json : ${nombre} passages`)
}
console.log(`✔ modèle dans ${dossierModeles.replace(`${RACINE}/`, '')}`)
