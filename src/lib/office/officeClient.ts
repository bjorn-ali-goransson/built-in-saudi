// The main-thread side of office.worker.ts. One worker for every editor,
// created on first use; requests are matched by id so a slow import cannot
// answer a later one.
let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>()

export class OfficeError extends Error {
  constructor(readonly code: string, message: string) { super(message) }
}

function get(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./office.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: { code: string; message: string } }>) => {
    const p = pending.get(e.data.id)
    if (!p) return
    pending.delete(e.data.id)
    if (e.data.ok) p.resolve(e.data.result)
    else p.reject(new OfficeError(e.data.error?.code || 'failed', e.data.error?.message || 'failed'))
  }
  // A worker that fails to LOAD (a chunk missing after a redeploy) answers nothing; fail them all.
  worker.onerror = (e) => {
    for (const [, p] of pending) p.reject(new OfficeError('worker', e.message || 'worker failed'))
    pending.clear()
    worker?.terminate()
    worker = null
  }
  return worker
}

export function office<T>(op: string, payload: { buf?: ArrayBuffer; data?: unknown; opts?: Record<string, unknown> } = {}): Promise<T> {
  const id = ++seq
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    const transfer = payload.buf ? [payload.buf] : []
    get().postMessage({ id, op, ...payload }, transfer)
  })
}

/** Readable explanation for an import failure, in either language. */
export function importErrorText(code: string, locale: 'en' | 'ar'): string {
  const en: Record<string, string> = {
    'legacy-binary': 'This is an old binary Office file (.doc, .xls or .ppt). Save it as .docx, .xlsx or .pptx in Office or LibreOffice, then open it here.',
    encrypted: 'This file is password-protected. Remove the password in Office (File → Info → Protect), then open it here.',
    'not-zip': 'This does not look like an Office file.',
    'not-ooxml': 'This is a ZIP file, but not an Office document.',
    'missing-part': 'The file is damaged — a part it refers to is missing.',
  }
  const ar: Record<string, string> = {
    'legacy-binary': 'هذا ملف أوفيس ثنائي قديم (.doc أو .xls أو .ppt). احفظه بصيغة .docx أو .xlsx أو .pptx في أوفيس أو ليبر أوفيس ثم افتحه هنا.',
    encrypted: 'هذا الملف محمي بكلمة مرور. أزل كلمة المرور في أوفيس (ملف ← معلومات ← حماية) ثم افتحه هنا.',
    'not-zip': 'لا يبدو هذا ملف أوفيس.',
    'not-ooxml': 'هذا ملف ZIP لكنه ليس مستند أوفيس.',
    'missing-part': 'الملف تالف — جزء يشير إليه مفقود.',
  }
  return (locale === 'ar' ? ar : en)[code] || (locale === 'ar' ? 'تعذّر فتح الملف.' : 'The file could not be opened.')
}
