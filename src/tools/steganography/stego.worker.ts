// LSB embed/reveal loops touch every pixel, so they run here off the main
// thread (#154). The File decodes here too (createImageBitmap + OffscreenCanvas
// both exist in workers) — the image never blocks the UI.
const MAGIC = 0x42495342 // "BISB" marker so reveal can tell a real payload apart

export type StegoRequest =
  | { id: number; op: 'embed'; file: File; message: string }
  | { id: number; op: 'reveal'; file: File }
export type StegoResponse =
  | { id: number; op: 'embed'; blob: Blob | null; tooBig?: boolean }
  | { id: number; op: 'reveal'; message: string | null }

async function imageData(file: File): Promise<ImageData> {
  const bmp = await createImageBitmap(file)
  const c = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  return ctx.getImageData(0, 0, c.width, c.height)
}

const setBit = (v: number, bit: number) => (v & 0xfe) | bit

function bitsOf(bytes: Uint8Array): number[] {
  const bits: number[] = []
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1)
  return bits
}

async function embed(file: File, message: string): Promise<StegoResponse & { op: 'embed' }> {
  const data = await imageData(file)
  const payload = new TextEncoder().encode(message)
  const header = new Uint8Array(8)
  new DataView(header.buffer).setUint32(0, MAGIC); new DataView(header.buffer).setUint32(4, payload.length)
  const bits = bitsOf(header).concat(bitsOf(payload))
  // 3 channels (RGB) per pixel carry one bit each
  const capacity = Math.floor((data.data.length / 4) * 3)
  if (bits.length > capacity) return { id: 0, op: 'embed', blob: null, tooBig: true }
  let bi = 0
  for (let p = 0; p < data.data.length && bi < bits.length; p += 4) {
    for (let ch = 0; ch < 3 && bi < bits.length; ch++) data.data[p + ch] = setBit(data.data[p + ch], bits[bi++])
  }
  const c = new OffscreenCanvas(data.width, data.height)
  c.getContext('2d')!.putImageData(data, 0, 0)
  const blob = await c.convertToBlob({ type: 'image/png' })
  return { id: 0, op: 'embed', blob }
}

async function reveal(file: File): Promise<StegoResponse & { op: 'reveal' }> {
  const data = await imageData(file)
  const readBits = (count: number, start: number) => {
    const out: number[] = []
    let idx = start
    for (let p = 0; p < data.data.length && out.length < count; p += 4) {
      for (let ch = 0; ch < 3 && out.length < count; ch++) { if (idx <= 0) out.push(data.data[p + ch] & 1); else idx-- }
    }
    return out
  }
  const bitsToBytes = (bits: number[]) => { const bytes = new Uint8Array(bits.length / 8); for (let i = 0; i < bytes.length; i++) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i * 8 + j]; bytes[i] = v } return bytes }
  const header = bitsToBytes(readBits(64, 0))
  const dv = new DataView(header.buffer)
  if (dv.getUint32(0) !== MAGIC) return { id: 0, op: 'reveal', message: null }
  const len = dv.getUint32(4)
  if (len <= 0 || len > (data.data.length / 4) * 3) return { id: 0, op: 'reveal', message: null }
  return { id: 0, op: 'reveal', message: new TextDecoder().decode(bitsToBytes(readBits(len * 8, 64))) }
}

self.onmessage = async (e: MessageEvent<StegoRequest>) => {
  const req = e.data
  const res = req.op === 'embed' ? await embed(req.file, req.message) : await reveal(req.file)
  postMessage({ ...res, id: req.id } satisfies StegoResponse)
}
