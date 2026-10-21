import { archiveZip } from '../lib/zip.ts'

// Un document Word minimal pour les tests (ADR 0038) : un titre de niveau 1, puis
// des paragraphes dont les parties entre ** sont en gras.

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const echapper = (texte: string) =>
  texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function paragraphe(texte: string): string {
  const parties = texte.split('**')
  const runs = parties
    .map((partie, i) =>
      partie === ''
        ? ''
        : `<w:r>${i % 2 === 1 ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${echapper(partie)}</w:t></w:r>`
    )
    .join('')
  return `<w:p>${runs}</w:p>`
}

export function documentWord(titre: string, paragraphes: string[]): Buffer {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${echapper(titre)}</w:t></w:r></w:p>${paragraphes.map(paragraphe).join('')}</w:body></w:document>`
  return archiveZip(
    new Map([
      [
        '[Content_Types].xml',
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`
        ),
      ],
      [
        '_rels/.rels',
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${TYPE}/officeDocument" Target="word/document.xml"/></Relationships>`
        ),
      ],
      [
        'word/_rels/document.xml.rels',
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${TYPE}/styles" Target="styles.xml"/></Relationships>`
        ),
      ],
      [
        'word/styles.xml',
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`
        ),
      ],
      ['word/document.xml', Buffer.from(document)],
    ])
  )
}
