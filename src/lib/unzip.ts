// Reading a ZIP, with no dependency.
//
// `zip.ts` next door only writes store-only archives, and the zip-inspector only
// walks the central directory to list names. Actually getting the bytes out
// needs DEFLATE, which the platform now provides: DecompressionStream is in
// every current engine, so an unzip is a hundred lines rather than a library.
//
// This exists because an .xlsx is a ZIP of XML — so is .docx, .pptx, .epub and
// an Android .apk — and "open the file the user has without uploading it"
// depends on being able to look inside one.

export interface ZipEntry {
  name: string
  /** Uncompressed size as declared in the central directory. */
  size: number
  method: number
  offset: number
  compressedSize: number
}

/** Walk the central directory. Returns null when this is not a ZIP at all. */
export function zipEntries(buf: ArrayBuffer): ZipEntry[] | null {
  const dv = new DataView(buf)
  const n = buf.byteLength
  let eocd = -1
  // The end record is last, but a trailing comment can push it back up to 64KB.
  for (let i = n - 22; i >= Math.max(0, n - 22 - 65536); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  const count = dv.getUint16(eocd + 10, true)
  let off = dv.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  const out: ZipEntry[] = []
  for (let i = 0; i < count && off + 46 <= n; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break
    const method = dv.getUint16(off + 10, true)
    const compressedSize = dv.getUint32(off + 20, true)
    const size = dv.getUint32(off + 24, true)
    const nameLen = dv.getUint16(off + 28, true)
    const extraLen = dv.getUint16(off + 30, true)
    const commentLen = dv.getUint16(off + 32, true)
    const localOffset = dv.getUint32(off + 42, true)
    const name = dec.decode(new Uint8Array(buf, off + 46, nameLen))
    out.push({ name, size, method, offset: localOffset, compressedSize })
    off += 46 + nameLen + extraLen + commentLen
  }
  return out
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The bytes of one entry, inflated if it needs it. */
export async function readEntry(buf: ArrayBuffer, entry: ZipEntry): Promise<Uint8Array> {
  const dv = new DataView(buf)
  if (dv.getUint32(entry.offset, true) !== 0x04034b50) throw new Error('bad-local-header')
  // The local header repeats the name and extra fields, and its extra length can
  // differ from the central directory's — read it from here, not from there.
  const nameLen = dv.getUint16(entry.offset + 26, true)
  const extraLen = dv.getUint16(entry.offset + 28, true)
  const start = entry.offset + 30 + nameLen + extraLen
  const raw = new Uint8Array(buf, start, entry.compressedSize)
  if (entry.method === 0) return new Uint8Array(raw)
  if (entry.method === 8) return inflateRaw(raw)
  throw new Error(`unsupported-method-${entry.method}`)
}

/** Every entry, as text. Convenient for the XML-in-a-zip formats. */
export async function readZipText(buf: ArrayBuffer, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  const entries = zipEntries(buf)
  if (!entries) throw new Error('not-a-zip')
  const dec = new TextDecoder()
  const out = new Map<string, string>()
  for (const e of entries) {
    if (e.name.endsWith('/') || !wanted(e.name)) continue
    out.set(e.name, dec.decode(await readEntry(buf, e)))
  }
  return out
}
