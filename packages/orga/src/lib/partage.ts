/**
 * Liens de partage : l'adresse d'une tâche, d'une fiche, d'une réunion ou d'une
 * séquence, que la personne colle dans un message ou une discussion. Le lien
 * n'ouvre aucun accès : la personne qui l'ouvre voit l'objet selon ses droits.
 */

/** L'adresse complète d'un chemin de l'espace organisateur. */
export function adresseComplete(
  chemin: string,
  origine = window.location.origin
) {
  return new URL(chemin, origine).toString()
}

const ECHAPPEMENTS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function echapper(texte: string) {
  return texte.replace(/[&<>"']/g, c => ECHAPPEMENTS[c] ?? c)
}

/**
 * Le titre et le lien, en deux formes. Le texte simple porte le titre puis
 * l'adresse sur la ligne suivante. Le HTML porte un lien dont le texte est le
 * titre : une messagerie ou un traitement de texte le colle ainsi.
 */
export function titreEtLien(titre: string, adresse: string) {
  return {
    texte: `${titre}\n${adresse}`,
    html: `<a href="${echapper(adresse)}">${echapper(titre)}</a>`,
  }
}

/**
 * Copie le lien seul, ou le titre et le lien. Un navigateur sans copie HTML
 * reçoit le texte simple.
 */
export async function copierLien(adresse: string, titre?: string) {
  if (titre === undefined) {
    await navigator.clipboard.writeText(adresse)
    return
  }
  const { texte, html } = titreEtLien(titre, adresse)
  if (typeof ClipboardItem === 'undefined') {
    await navigator.clipboard.writeText(texte)
    return
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([texte], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    }),
  ])
}
