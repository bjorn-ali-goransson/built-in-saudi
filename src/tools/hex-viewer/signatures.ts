// File type by magic number. The extension is a claim; the first few bytes are
// evidence. Keeping them separate is the point of the tool — a .jpg that starts
// with PK is a zip someone renamed.

export interface Signature {
  label: string
  extensions: string[]
  /** Bytes to match, with null meaning "any byte here". */
  magic: (number | null)[]
  offset?: number
}

const SIGS: Signature[] = [
  { label: 'PNG image', extensions: ['png'], magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { label: 'JPEG image', extensions: ['jpg', 'jpeg'], magic: [0xff, 0xd8, 0xff] },
  { label: 'GIF image', extensions: ['gif'], magic: [0x47, 0x49, 0x46, 0x38] },
  { label: 'WebP image', extensions: ['webp'], magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50] },
  { label: 'BMP image', extensions: ['bmp'], magic: [0x42, 0x4d] },
  { label: 'TIFF image', extensions: ['tif', 'tiff'], magic: [0x49, 0x49, 0x2a, 0x00] },
  { label: 'HEIC/HEIF image', extensions: ['heic', 'heif'], magic: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { label: 'PDF document', extensions: ['pdf'], magic: [0x25, 0x50, 0x44, 0x46] },
  { label: 'ZIP archive (or docx/xlsx/pptx/epub)', extensions: ['zip', 'docx', 'xlsx', 'pptx', 'epub', 'jar', 'apk'], magic: [0x50, 0x4b, 0x03, 0x04] },
  { label: 'RAR archive', extensions: ['rar'], magic: [0x52, 0x61, 0x72, 0x21] },
  { label: '7-Zip archive', extensions: ['7z'], magic: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { label: 'GZIP archive', extensions: ['gz', 'tgz'], magic: [0x1f, 0x8b] },
  { label: 'MP3 audio', extensions: ['mp3'], magic: [0x49, 0x44, 0x33] },
  { label: 'WAV audio', extensions: ['wav'], magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x41, 0x56, 0x45] },
  { label: 'FLAC audio', extensions: ['flac'], magic: [0x66, 0x4c, 0x61, 0x43] },
  { label: 'OGG audio', extensions: ['ogg', 'oga', 'opus'], magic: [0x4f, 0x67, 0x67, 0x53] },
  { label: 'MP4 / MOV video', extensions: ['mp4', 'm4a', 'm4v', 'mov'], magic: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { label: 'Matroska / WebM video', extensions: ['mkv', 'webm'], magic: [0x1a, 0x45, 0xdf, 0xa3] },
  { label: 'AVI video', extensions: ['avi'], magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x41, 0x56, 0x49, 0x20] },
  { label: 'Windows executable', extensions: ['exe', 'dll'], magic: [0x4d, 0x5a] },
  { label: 'ELF executable', extensions: ['elf', 'so'], magic: [0x7f, 0x45, 0x4c, 0x46] },
  { label: 'Java class', extensions: ['class'], magic: [0xca, 0xfe, 0xba, 0xbe] },
  { label: 'SQLite database', extensions: ['sqlite', 'db'], magic: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65] },
  { label: 'TrueType font', extensions: ['ttf'], magic: [0x00, 0x01, 0x00, 0x00, 0x00] },
  { label: 'WOFF2 font', extensions: ['woff2'], magic: [0x77, 0x4f, 0x46, 0x32] },
  { label: 'RTF document', extensions: ['rtf'], magic: [0x7b, 0x5c, 0x72, 0x74, 0x66] },
  { label: 'Legacy Office document', extensions: ['doc', 'xls', 'ppt'], magic: [0xd0, 0xcf, 0x11, 0xe0] },
]

function matches(bytes: Uint8Array, sig: Signature): boolean {
  const at = sig.offset ?? 0
  if (bytes.length < at + sig.magic.length) return false
  for (let i = 0; i < sig.magic.length; i++) {
    const expected = sig.magic[i]
    if (expected !== null && bytes[at + i] !== expected) return false
  }
  return true
}

export function sniff(bytes: Uint8Array): Signature | null {
  // HEIC and MP4 share the same ftyp box, so the brand that follows decides.
  const ftyp = SIGS.find((s) => s.offset === 4 && matches(bytes, s))
  if (ftyp) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12))
    if (/^(heic|heix|hevc|mif1|msf1|heis)/i.test(brand)) return SIGS.find((s) => s.label.startsWith('HEIC'))!
    return SIGS.find((s) => s.label.startsWith('MP4'))!
  }
  for (const sig of SIGS) {
    if (sig.offset) continue
    if (matches(bytes, sig)) return sig
  }
  // Plain text is the absence of a signature plus the absence of control bytes.
  const head = bytes.subarray(0, 512)
  if (head.length && ![...head].some((b) => b < 9 || (b > 13 && b < 32))) {
    return { label: 'Plain text', extensions: ['txt', 'csv', 'json', 'md', 'xml', 'html', 'js', 'ts', 'css', 'svg', 'log', 'yml', 'yaml'], magic: [] }
  }
  return null
}
