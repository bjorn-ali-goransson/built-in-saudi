// Read a PDF's interactive AcroForm fields with pdf.js: names, human labels
// (the /TU tooltip), types, options, initial values, and rotation-correct
// rectangles (normalised, top-left origin) for on-page overlays. pdf-lib does
// the actual filling on export (by field name); this is detection only.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type FieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'listbox'

export interface FieldRect { page: number; x: number; y: number; w: number; h: number; value?: string }

export interface FormField {
  name: string
  type: FieldType
  label: string
  page: number
  rects: FieldRect[]
  options?: string[]
  onValue?: string   // checkbox "on" state
  multiline?: boolean
  maxLen?: number
  readOnly?: boolean
  initial?: string   // text/dropdown/listbox/radio selected value
  checked?: boolean  // checkbox
}

export interface FormScan { fields: FormField[]; htmlMode: boolean; pageCount: number }

const CRYPTIC = /^(text|field|fld|untitled|f|checkbox|check|cb|rb)\s*\d+$/i

/** A name is "descriptive" if the form gave it a tooltip or a human-ish name
 *  (not "Text1" / not an XFA path like topmostSubform[0].Page1[0].f1_01[0]). */
function descriptive(name: string, label: string): boolean {
  if (label.trim()) return true
  if (/\[\d+\]/.test(name)) return false          // XFA path
  if (CRYPTIC.test(name)) return false
  return /[A-Za-z؀-ۿ]{3,}/.test(name)     // has a real word (Latin or Arabic)
}

/** Turn "applicant.firstName" / "applicant_first_name" into "First Name". */
export function prettify(name: string): string {
  const last = name.split('.').pop() || name
  return last
    .replace(/\[\d+\]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

export async function scanFields(data: ArrayBuffer): Promise<FormScan> {
  const forLib = data.slice(0) // pdf.js may detach `data`; keep a copy for pdf-lib
  const doc = await pdfjs.getDocument({ data }).promise
  const byName = new Map<string, FormField>()

  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1)
    const vp = page.getViewport({ scale: 1 })
    const anns = await page.getAnnotations()
    for (const a of anns as Record<string, unknown>[]) {
      if (a.subtype !== 'Widget' || !a.fieldType || a.fieldName == null) continue
      const name = String(a.fieldName)
      const ft = String(a.fieldType) // Tx / Btn / Ch
      if (ft === 'Btn' && a.pushButton) continue

      // rotation-correct, top-left-origin normalised rect (method exists at
      // runtime but isn't in pdf.js's published types)
      const toVp = (vp as unknown as { convertToViewportRectangle(r: number[]): number[] }).convertToViewportRectangle
      const [x1, y1, x2, y2] = toVp.call(vp, a.rect as number[])
      const rect: FieldRect = {
        page: i,
        x: Math.min(x1, x2) / vp.width,
        y: Math.min(y1, y2) / vp.height,
        w: Math.abs(x2 - x1) / vp.width,
        h: Math.abs(y2 - y1) / vp.height,
      }
      const label = String(a.alternativeText || '')

      let type: FieldType
      if (ft === 'Tx') type = 'text'
      else if (ft === 'Ch') type = a.combo ? 'dropdown' : 'listbox'
      else type = a.radioButton ? 'radio' : 'checkbox'

      let f = byName.get(name)
      if (!f) {
        f = { name, type, label, page: i, rects: [] }
        if (type === 'dropdown' || type === 'listbox') {
          f.options = ((a.options as { exportValue?: string; displayValue?: string }[]) || []).map((o) => String(o.exportValue ?? o.displayValue ?? ''))
          f.initial = a.fieldValue != null ? String(a.fieldValue) : ''
        }
        if (type === 'text') { f.initial = a.fieldValue != null ? String(a.fieldValue) : ''; f.multiline = !!a.multiLine; if (a.maxLen) f.maxLen = Number(a.maxLen) }
        if (type === 'checkbox') { f.onValue = a.exportValue ? String(a.exportValue) : 'Yes'; f.checked = a.fieldValue != null && String(a.fieldValue) !== 'Off' && String(a.fieldValue) !== '' }
        if (type === 'radio') { f.options = []; f.initial = a.fieldValue != null ? String(a.fieldValue) : '' }
        f.readOnly = !!a.readOnly
        byName.set(name, f)
      }
      if (type === 'radio') {
        const val = a.buttonValue != null ? String(a.buttonValue) : (a.exportValue != null ? String(a.exportValue) : `opt${f.rects.length}`)
        rect.value = val
        if (f.options && !f.options.includes(val)) f.options.push(val)
      }
      f.rects.push(rect)
    }
  }

  // pdf.js doesn't surface the /TU tooltip, so read it via pdf-lib (which we load
  // anyway for filling) — real forms often have cryptic names but good tooltips.
  try {
    const { PDFDocument, PDFName, PDFString } = await import('pdf-lib')
    const lib = await PDFDocument.load(forLib)
    for (const f of lib.getForm().getFields()) {
      const ff = byName.get(f.getName())
      if (ff && !ff.label.trim()) {
        const tu = f.acroField.dict.lookupMaybe(PDFName.of('TU'), PDFString)
        if (tu) ff.label = tu.decodeText()
      }
    }
  } catch { /* no AcroForm / unreadable — name-based labels still apply */ }

  const fields = [...byName.values()]
  const named = fields.filter((f) => descriptive(f.name, f.label)).length
  const htmlMode = fields.length > 0 && named / fields.length >= 0.6
  return { fields, htmlMode, pageCount: doc.numPages }
}

/** Display label for a field: tooltip → prettified name → the raw name. */
export function fieldLabel(f: FormField): string {
  return f.label.trim() || prettify(f.name) || f.name
}
