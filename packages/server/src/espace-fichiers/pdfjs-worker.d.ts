// Le module de travail de pdf.js, chargé dans le fil d'extraction (ADR 0072). Le
// paquet ne publie pas ses types.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown
}
