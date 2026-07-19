// Archive sniffing + ZIP central-directory parsing run here so a multi-GB
// archive is read and walked off the main thread (#154).
export interface Entry { name: string; size: number; comp: number; method: number; date: Date | null; dir: boolean }
export interface ZipRequest { id: number; file: File }
export interface ZipResponse { id: number; format: string; entries: Entry[] | null }

// Detect common archive/compression formats by magic bytes.
function detectFormat(b: Uint8Array): string {
  const h = (n: number) => b[n]
  if (h(0) === 0x50 && h(1) === 0x4b && (h(2) === 0x03 || h(2) === 0x05 || h(2) === 0x07)) return 'ZIP'
  if (h(0) === 0x1f && h(1) === 0x8b) return 'GZIP'
  if (h(0) === 0x42 && h(1) === 0x5a && h(2) === 0x68) return 'BZIP2'
  if (h(0) === 0xfd && h(1) === 0x37 && h(2) === 0x7a && h(3) === 0x58 && h(4) === 0x5a) return 'XZ'
  if (h(0) === 0x37 && h(1) === 0x7a && h(2) === 0xbc && h(3) === 0xaf) return '7-Zip'
  if (h(0) === 0x52 && h(1) === 0x61 && h(2) === 0x72 && h(3) === 0x21) return 'RAR'
  if (h(0) === 0x04 && h(1) === 0x22 && h(2) === 0x4d && h(3) === 0x18) return 'LZ4'
  if (h(0) === 0x28 && h(1) === 0xb5 && h(2) === 0x2f && h(3) === 0xfd) return 'Zstandard'
  // tar: "ustar" at offset 257
  if (b.length > 262 && b[257] === 0x75 && b[258] === 0x73 && b[259] === 0x74 && b[260] === 0x61 && b[261] === 0x72) return 'TAR'
  return ''
}

// Parse a ZIP central directory. Returns null if not a valid ZIP.
function parseZip(buf: ArrayBuffer): Entry[] | null {
  const dv = new DataView(buf)
  const n = buf.byteLength
  // Find End Of Central Directory (signature 0x06054b50), scanning back from the end.
  let eocd = -1
  for (let i = n - 22; i >= Math.max(0, n - 22 - 65536); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  const count = dv.getUint16(eocd + 10, true)
  let off = dv.getUint32(eocd + 16, true)
  const dec = new TextDecoder()
  const out: Entry[] = []
  for (let i = 0; i < count && off + 46 <= n; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break
    const method = dv.getUint16(off + 10, true)
    const dosTime = dv.getUint16(off + 12, true)
    const dosDate = dv.getUint16(off + 14, true)
    const comp = dv.getUint32(off + 20, true)
    const size = dv.getUint32(off + 24, true)
    const nameLen = dv.getUint16(off + 28, true)
    const extraLen = dv.getUint16(off + 30, true)
    const commentLen = dv.getUint16(off + 32, true)
    const name = dec.decode(new Uint8Array(buf, off + 46, nameLen))
    let date: Date | null = null
    if (dosDate) {
      date = new Date(1980 + (dosDate >> 9), ((dosDate >> 5) & 0xf) - 1, dosDate & 0x1f,
        dosTime >> 11, (dosTime >> 5) & 0x3f, (dosTime & 0x1f) * 2)
    }
    out.push({ name, size, comp, method, date, dir: name.endsWith('/') })
    off += 46 + nameLen + extraLen + commentLen
  }
  return out
}

self.onmessage = async (e: MessageEvent<ZipRequest>) => {
  const { id, file } = e.data
  const buf = await file.arrayBuffer()
  const format = detectFormat(new Uint8Array(buf.slice(0, 512)))
  const entries = format === 'ZIP' ? parseZip(buf) : null
  postMessage({ id, format, entries } satisfies ZipResponse)
}
