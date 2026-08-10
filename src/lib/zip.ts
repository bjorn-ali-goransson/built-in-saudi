// ZIP writing. Standard PKZIP, no dependency.
//
// `zipStore` writes uncompressed entries and is what everything used, because
// the ZIP spec allows it and it is enough to bundle a handful of files. `zipFile`
// compresses, using `CompressionStream('deflate-raw')` — the exact mirror of the
// `DecompressionStream('deflate-raw')` that `lib/unzip.ts` already reads with,
// so it costs nothing new and the site already requires the API.
//
// WHETHER IT IS WORTH IT IS A QUESTION ABOUT THE PAYLOADS, and it was measured
// (`node evals/zipsize.mjs`) rather than assumed:
//
//   OOXML document.xml (.docx/.xlsx/.epub)    97.9% smaller
//   SVG paths                                 85.8%
//   CSV rows (csv-split)                      83.0%
//   PDF · PNG · an existing .xlsx              ~5%
//
// So the answer is not "always compress" — it is **per entry, keeping whichever
// came out smaller.** A PDF and a PNG carry deflate streams inside them
// already; spending CPU to make them 5% smaller, and sometimes larger, is work
// thrown away. Entries whose extension says they are already compressed skip
// the attempt entirely rather than being deflated and then discarded.

function crc32(buf: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return (~c) >>> 0
}

const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]

export interface ZipEntry {
  name: string
  bytes: Uint8Array
  /**
   * Force this entry to be stored uncompressed.
   *
   * Load-bearing for EPUB: the spec requires `mimetype` to be the first entry
   * AND stored, because that is how a reader identifies the file without
   * inflating anything. A compressed `mimetype` produces a book that readers
   * silently refuse rather than explaining.
   */
  store?: boolean
}

/**
 * General-purpose bit 11 — "the name is UTF-8".
 *
 * **This was missing, and it is a real bug on a bilingual site.** Without it an
 * extractor is entitled to read the name as CP437, so an Arabic filename comes
 * out as mojibake — and these tools name entries after the user's own file or
 * after a column value, both of which are routinely Arabic here. Set only when
 * the name is actually non-ASCII, because setting it unconditionally is a claim
 * about every entry and some old extractors treat the flag as a hint to change
 * behaviour.
 */
const utf8Flag = (name: string) => (/^[\x20-\x7e]*$/.test(name) ? 0 : 0x800)

/** Extensions whose contents already carry a deflate (or similar) stream. */
const ALREADY_COMPRESSED = /\.(png|jpe?g|webp|avif|heic|gif|pdf|zip|docx|xlsx|pptx|epub|mp4|m4a|mp3|ogg|webm|woff2?|gz|br)$/i

interface Built { name: Uint8Array; bytes: Uint8Array; crc: number; size: number; method: number; flag: number }

function assemble(built: Built[]): Blob {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of built) {
    const local = Uint8Array.from([
      0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(f.flag), ...u16(f.method), ...u16(0), ...u16(0),
      ...u32(f.crc), ...u32(f.bytes.length), ...u32(f.size), ...u16(f.name.length), ...u16(0),
    ])
    parts.push(local, f.name, f.bytes)
    central.push(Uint8Array.from([
      0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(f.flag), ...u16(f.method), ...u16(0), ...u16(0),
      ...u32(f.crc), ...u32(f.bytes.length), ...u32(f.size), ...u16(f.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset), ...f.name,
    ]))
    offset += local.length + f.name.length + f.bytes.length
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const end = Uint8Array.from([
    0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(built.length), ...u16(built.length),
    ...u32(cdSize), ...u32(offset), ...u16(0),
  ])
  return new Blob([...parts, ...central, end] as BlobPart[], { type: 'application/zip' })
}

/** Uncompressed archive. Synchronous, and still correct for every reader. */
export function zipStore(files: { name: string; bytes: Uint8Array }[]): Blob {
  const enc = new TextEncoder()
  return assemble(files.map((f) => ({
    name: enc.encode(f.name),
    bytes: f.bytes,
    crc: crc32(f.bytes),
    size: f.bytes.length,
    method: 0,
    flag: utf8Flag(f.name),
  })))
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw')
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(cs)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Compressed archive — deflate per entry, keeping whichever came out smaller.
 *
 * The CRC and the uncompressed size are always of the ORIGINAL bytes, whichever
 * form is stored; getting that wrong produces an archive every extractor opens
 * and then reports as corrupt.
 */
export async function zipFile(files: ZipEntry[]): Promise<Blob> {
  const enc = new TextEncoder()
  const built: Built[] = []
  for (const f of files) {
    const crc = crc32(f.bytes)
    const size = f.bytes.length
    let bytes = f.bytes
    let method = 0
    // Empty entries are left alone: deflating nothing produces a 2-byte stream,
    // i.e. an entry that grew.
    if (!f.store && size > 0 && !ALREADY_COMPRESSED.test(f.name)) {
      try {
        const packed = await deflate(f.bytes)
        if (packed.length < size) { bytes = packed; method = 8 }
      } catch {
        // A browser without CompressionStream still gets a valid archive, just
        // a bigger one. Falling back beats failing to produce a file at all.
      }
    }
    built.push({ name: enc.encode(f.name), bytes, crc, size, method, flag: utf8Flag(f.name) })
  }
  return assemble(built)
}
