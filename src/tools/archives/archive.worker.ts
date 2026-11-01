// Opening and making archives, off the main thread (#154).
//
// A worker because both directions are a loop over every byte of the archive:
// inflating a 200MB zip, or deflating forty photos into one, would freeze the
// page for seconds — nothing scrolls, no spinner turns, and the tool looks
// broken rather than busy.
//
// The opened archive STAYS HERE. The page is told the names and sizes and asks
// for one entry's bytes when somebody downloads it, so an archive with a
// thousand files in it is not copied across into the page a thousand times.
import { zipEntries, readEntry, type ZipEntry as ZipDirEntry } from '../../lib/unzip'
import { zipFile } from '../../lib/zip'
import { sniff, readTar, writeTar, gzipName, stripGz, isTar, type Item, type Kind } from './formats'
import unrarWasm from 'node-unrar-js/esm/js/unrar.wasm?url'

export type Format = 'zip' | 'tar.gz' | 'tar' | 'gz'

export type ArchiveRequest =
  | { id: number; op: 'open'; file: File; password?: string }
  | { id: number; op: 'entry'; index: number }
  | { id: number; op: 'all' }
  | { id: number; op: 'create'; files: { name: string; file: File }[]; format: Format }

export interface Listed { name: string; dir: boolean; size: number; problem?: 'encrypted' | 'method' }

export type ArchiveResponse =
  | { id: number; ok: true; kind: Kind; inner?: 'tar'; entries: Listed[] }
  | { id: number; ok: true; bytes: Uint8Array }
  | { id: number; ok: false; why: Why; kind?: Kind }

/**
 * Why an open failed. Each one is a different thing to tell somebody, which is
 * the whole reason for not collapsing them into "could not read this file".
 */
export type Why = 'password' | 'wrong-password' | 'unsupported' | 'damaged' | 'unknown' | 'entry'

// What the page can ask about the archive it last opened.
type Opened =
  | { kind: 'zip'; buf: ArrayBuffer; dir: ZipDirEntry[] }
  | { kind: 'items'; items: Item[] }
let opened: Opened | null = null

const reply = (r: ArchiveResponse, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(r, transfer)

async function gunzip(b: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([b as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(s).arrayBuffer())
}

async function gzip(b: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([b as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(s).arrayBuffer())
}

async function unrar(buf: ArrayBuffer, password?: string): Promise<Item[]> {
  // The decoder is fetched only when a RAR is actually opened: a zip never
  // pays for it. Served from this site, like every other engine here.
  const [{ createExtractorFromData }, wasm] = await Promise.all([
    import('node-unrar-js'),
    fetch(unrarWasm).then((r) => r.arrayBuffer()),
  ])
  const ex = await createExtractorFromData({ wasmBinary: wasm, data: buf, password: password ?? '' })
  const items: Item[] = []
  for (const f of ex.extract().files) {
    const h = f.fileHeader
    items.push(h.flags.directory
      ? { name: h.name.endsWith('/') ? h.name : `${h.name}/`, dir: true, size: 0 }
      : { name: h.name, dir: false, size: h.unpSize, bytes: f.extraction ?? new Uint8Array() })
  }
  return items
}

/** unrar reports a password problem in its message; nothing else does. */
function rarWhy(e: unknown, given: boolean): Why {
  const m = String((e as { reason?: string })?.reason ?? (e as Error)?.message ?? e)
  if (/password|encrypt/i.test(m)) return given ? 'wrong-password' : 'password'
  if (/crc|corrupt|bad|eof/i.test(m)) return 'damaged'
  return 'damaged'
}

const listItems = (items: Item[]): Listed[] => items.map(({ name, dir, size }) => ({ name, dir, size }))

async function open(file: File, password?: string): Promise<ArchiveResponse & { id: 0 }> {
  const buf = await file.arrayBuffer()
  const head = new Uint8Array(buf, 0, Math.min(buf.byteLength, 1024))
  const kind = sniff(head.length >= 512 ? head : new Uint8Array(buf))
  if (kind === 'zip') {
    const dir = zipEntries(buf)
    if (!dir) return { id: 0, ok: false, why: 'damaged', kind }
    opened = { kind: 'zip', buf, dir }
    const dv = new DataView(buf)
    return {
      id: 0, ok: true, kind,
      entries: dir.map((e) => {
        // Bit 0 of the local header's flags: this entry is encrypted. Neither
        // ZipCrypto nor AES is something the platform can decrypt, so it is
        // NAMED per entry rather than failing the whole archive.
        let flags = 0
        try { flags = dv.getUint16(e.offset + 6, true) } catch { /* reported as damaged on read */ }
        const problem = flags & 1 ? 'encrypted' as const : e.method !== 0 && e.method !== 8 ? 'method' as const : undefined
        return { name: e.name, dir: e.name.endsWith('/'), size: e.size, problem }
      }),
    }
  }
  if (kind === 'rar') {
    try {
      const items = await unrar(buf, password)
      opened = { kind: 'items', items }
      return { id: 0, ok: true, kind, entries: listItems(items) }
    } catch (e) {
      return { id: 0, ok: false, why: rarWhy(e, !!password), kind }
    }
  }
  if (kind === 'gzip') {
    let out: Uint8Array
    try { out = await gunzip(new Uint8Array(buf)) } catch { return { id: 0, ok: false, why: 'damaged', kind } }
    // A .tar.gz is a gzip of a tar, and what somebody wants out of it is the
    // files, not one enormous .tar they then have to open somewhere else.
    if (isTar(out)) {
      const items = readTar(out)
      opened = { kind: 'items', items }
      return { id: 0, ok: true, kind, inner: 'tar', entries: listItems(items) }
    }
    const name = gzipName(new Uint8Array(buf)) ?? stripGz(file.name)
    const items: Item[] = [{ name, dir: false, size: out.length, bytes: out }]
    opened = { kind: 'items', items }
    return { id: 0, ok: true, kind, entries: listItems(items) }
  }
  if (kind === 'tar') {
    const items = readTar(new Uint8Array(buf))
    opened = { kind: 'items', items }
    return { id: 0, ok: true, kind, entries: listItems(items) }
  }
  return { id: 0, ok: false, why: kind === 'unknown' ? 'unknown' : 'unsupported', kind }
}

async function entryBytes(i: number): Promise<Uint8Array> {
  if (!opened) throw new Error('nothing-open')
  if (opened.kind === 'zip') return readEntry(opened.buf, opened.dir[i])
  // A COPY: a tar entry is a view into the whole archive, and transferring a
  // view's buffer to the page would detach every other entry along with it.
  return (opened.items[i].bytes ?? new Uint8Array()).slice()
}

/** Every file in the open archive, as one zip — the one format every system opens. */
async function all(): Promise<Uint8Array> {
  if (!opened) throw new Error('nothing-open')
  const files: { name: string; bytes: Uint8Array }[] = []
  const n = opened.kind === 'zip' ? opened.dir.length : opened.items.length
  for (let i = 0; i < n; i++) {
    const name = opened.kind === 'zip' ? opened.dir[i].name : opened.items[i].name
    if (name.endsWith('/')) continue
    try { files.push({ name, bytes: await entryBytes(i) }) } catch { /* an unreadable entry is listed as such; the rest still come out */ }
  }
  return new Uint8Array(await (await zipFile(files)).arrayBuffer())
}

async function create(list: { name: string; file: File }[], format: Format): Promise<Uint8Array> {
  const files = await Promise.all(list.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.file.arrayBuffer()) })))
  if (format === 'zip') return new Uint8Array(await (await zipFile(files)).arrayBuffer())
  if (format === 'gz') return gzip(files[0].bytes)
  const tar = writeTar(files)
  return format === 'tar' ? tar : gzip(tar)
}

self.onmessage = async (e: MessageEvent<ArchiveRequest>) => {
  const req = e.data
  try {
    if (req.op === 'open') {
      opened = null
      const r = await open(req.file, req.password)
      reply({ ...r, id: req.id } as ArchiveResponse)
    } else if (req.op === 'entry') {
      const bytes = await entryBytes(req.index)
      reply({ id: req.id, ok: true, bytes }, [bytes.buffer])
    } else if (req.op === 'all') {
      const bytes = await all()
      reply({ id: req.id, ok: true, bytes }, [bytes.buffer])
    } else {
      const bytes = await create(req.files, req.format)
      reply({ id: req.id, ok: true, bytes }, [bytes.buffer])
    }
  } catch {
    reply({ id: req.id, ok: false, why: req.op === 'entry' ? 'entry' : 'damaged' })
  }
}
