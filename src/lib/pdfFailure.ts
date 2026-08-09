/**
 * Why a pdf-lib load failed, when it is worth acting on.
 *
 * `encrypted` is the one that matters: pdf-lib CANNOT open a password-protected
 * PDF at all — `ignoreEncryption` parses the structure and leaves the streams
 * encrypted — so a tool built on it has nothing to offer. pdf.js can, with the
 * password the reader already has, which is why the distinction earns a route
 * rather than only a better sentence.
 *
 * This lives in `lib/` with no imports of its own because it has eight callers:
 * `pdfOps.worker.ts` and the seven tools that load pdf-lib directly. It was the
 * worker's private code for a while, and in that time three tools
 * (`pdf-fill`, `pdf-compress`, `pdf-edit`) reported EVERY failure as "locked /
 * encrypted" — so a corrupt file was blamed on a password it does not have —
 * while three more (`pdf-stamp`, `pdf-booklet`, `pdf-redact`) reported every
 * failure as unreadable, so a genuinely locked file was given no reason and
 * nowhere to go. Both halves are the same bug: a guess where an answer was
 * available.
 */
export type PdfFailure = 'encrypted' | 'unreadable'

/**
 * Each library's own error is the authority. Sniffing the bytes for `/Encrypt`
 * would be a heuristic that is wrong in the direction that matters, telling
 * somebody their perfectly ordinary PDF is locked.
 *
 * **TWO libraries, and this only knew about one.** pdf-lib says "Input document
 * to `PDFDocument.load` is encrypted", which the message test catches. But
 * several of these tools read with **pdf.js** first — for thumbnails, for form
 * fields, for page images — and pdf.js throws a `PasswordException` whose
 * message is "No password given". That contains no such word, so a locked file
 * came back `unreadable`: the very mistake this module exists to stop, inside
 * the module itself. Caught by feeding the real locked fixture to all seven
 * tools rather than to the one it was written against.
 */
export function pdfFailure(e: unknown): PdfFailure {
  const err = e as { message?: string; name?: string } | null
  if (err?.name === 'PasswordException') return 'encrypted'
  return /encrypted/i.test(err?.message || '') ? 'encrypted' : 'unreadable'
}
