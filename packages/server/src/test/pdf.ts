// Un PDF minimal pour les tests (ADR 0072) : une page par texte, en Helvetica, sans
// police embarquée. Le texte reste en ASCII ; les parenthèses et les barres
// obliques inverses sont échappées.

const echapper = (texte: string) => texte.replace(/[()\\]/g, c => `\\${c}`)

export function documentPdf(pages: readonly string[]): Uint8Array {
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + 2 * i} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  pages.forEach((texte, i) => {
    const flux = `BT /F1 12 Tf 72 712 Td (${echapper(texte)}) Tj ET`
    objets.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * i} 0 R >>`,
      `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`
    )
  })
  let sortie = '%PDF-1.4\n'
  const positions: number[] = []
  objets.forEach((objet, i) => {
    positions.push(sortie.length)
    sortie += `${i + 1} 0 obj\n${objet}\nendobj\n`
  })
  const xref = sortie.length
  sortie += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`
  sortie += positions
    .map(p => `${String(p).padStart(10, '0')} 00000 n \n`)
    .join('')
  sortie += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(sortie, 'latin1'))
}
