// Every Office import and export runs here, off the main thread (#154).
//
// A 20MB workbook or a deck with a hundred photos is seconds of unzipping and
// XML parsing; on the main thread that is a frozen page with no spinner. Each
// format's code is imported on first use, so opening a spreadsheet never loads
// the word processor's converter.
//
// A worker that throws somewhere a promise cannot catch would post nothing, and
// the editor would wait for ever — so `error` and `unhandledrejection` answer
// every request still in flight. A hung UI is worse than an error.
type Req = { id: number; op: string; buf?: ArrayBuffer; data?: unknown; opts?: Record<string, unknown> }

const inflight = new Set<number>()
const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg)
const fail = (id: number, e: unknown) => {
  const err = e as { code?: string; message?: string }
  post({ id, ok: false, error: { code: err?.code || 'failed', message: String(err?.message || e) } })
}

self.addEventListener('error', (e) => { for (const id of inflight) fail(id, (e as ErrorEvent).error || e); inflight.clear() })
self.addEventListener('unhandledrejection', (e) => { for (const id of inflight) fail(id, (e as PromiseRejectionEvent).reason); inflight.clear() })

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, op, buf, data, opts } = e.data
  inflight.add(id)
  try {
    const result = await run(op, buf, data, opts || {})
    post({ id, ok: true, result })
  } catch (err) {
    fail(id, err)
  } finally {
    inflight.delete(id)
  }
}

async function run(op: string, buf: ArrayBuffer | undefined, data: unknown, opts: Record<string, unknown>): Promise<unknown> {
  switch (op) {
    case 'xlsx-read': return (await import('../../tools/excel-editor/io/xlsx-read')).readXlsx(buf!)
    case 'xlsx-write': return (await import('../../tools/excel-editor/io/xlsx-write')).writeXlsx(data as never, opts as never)
    case 'ods-read': return (await import('../../tools/excel-editor/io/ods-read')).readOds(buf!)
    case 'csv-read': {
      const m = await import('../../tools/excel-editor/io/csv-io')
      return { book: { sheets: [m.readCsv(new TextDecoder().decode(buf!), String(opts.name || 'Sheet1'))] }, loss: [] }
    }
    case 'csv-write': return (await import('../../tools/excel-editor/io/csv-io')).writeCsv(data as never, String(opts.sheet), (opts.delimiter as ',') || ',')
  }
  throw Object.assign(new Error('unknown op ' + op), { code: 'unknown-op' })
}
