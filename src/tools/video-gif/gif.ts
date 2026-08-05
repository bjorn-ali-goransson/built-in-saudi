// A GIF encoder, written out rather than pulled in.
//
// Every JS GIF library is either abandoned, ships a worker blob it fetches from
// a CDN, or is far larger than the format deserves — GIF89a is a 1989 spec whose
// only real complexity is LZW, and that is ~60 lines. Writing it keeps the tool
// dependency-free and keeps the privacy claim literal.

interface Frame { indices: Uint8Array; palette: number[][] }

/**
 * Median-cut quantisation to at most 256 colours, shared across ALL frames.
 * A per-frame palette would look marginally better and would make the file
 * flicker as the palette swaps — which is exactly the artefact people blame on
 * "cheap GIF converters".
 */
function quantise(frames: Uint8ClampedArray[], maxColours: number): { palette: number[][]; map: Map<number, number> } {
  const counts = new Map<number, number>()
  for (const data of frames) {
    // 5 bits per channel: 32k buckets is plenty to cut on, and keeps the
    // histogram small enough to build over several frames.
    for (let i = 0; i < data.length; i += 4) {
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const pixels = [...counts.entries()].map(([key, n]) => ({
    r: ((key >> 10) & 31) << 3, g: ((key >> 5) & 31) << 3, b: (key & 31) << 3, n,
  }))

  type Box = typeof pixels
  let boxes: Box[] = [pixels]
  while (boxes.length < maxColours) {
    // Split the box with the widest channel spread, weighted by how many pixels
    // it holds — splitting a large flat area buys nothing.
    let bestIdx = -1
    let bestScore = -1
    let bestChannel: 'r' | 'g' | 'b' = 'r'
    boxes.forEach((box, i) => {
      if (box.length < 2) return
      for (const c of ['r', 'g', 'b'] as const) {
        let min = 255, max = 0
        for (const p of box) { if (p[c] < min) min = p[c]; if (p[c] > max) max = p[c] }
        const total = box.reduce((n, p) => n + p.n, 0)
        const score = (max - min) * Math.log2(total + 1)
        if (score > bestScore) { bestScore = score; bestIdx = i; bestChannel = c }
      }
    })
    if (bestIdx < 0) break
    const box = boxes[bestIdx].slice().sort((a, b) => a[bestChannel] - b[bestChannel])
    const mid = Math.floor(box.length / 2)
    boxes = [...boxes.slice(0, bestIdx), box.slice(0, mid), box.slice(mid), ...boxes.slice(bestIdx + 1)]
      .filter((b) => b.length)
  }

  const palette = boxes.map((box) => {
    let r = 0, g = 0, b = 0, n = 0
    for (const p of box) { r += p.r * p.n; g += p.g * p.n; b += p.b * p.n; n += p.n }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
  })

  // Map every histogram bucket to its box's colour, once, so per-pixel lookup is
  // a hash hit rather than a nearest-neighbour search over 256 entries.
  const map = new Map<number, number>()
  boxes.forEach((box, index) => {
    for (const p of box) {
      map.set(((p.r >> 3) << 10) | ((p.g >> 3) << 5) | (p.b >> 3), index)
    }
  })
  return { palette, map }
}

function toIndices(data: Uint8ClampedArray, map: Map<number, number>): Uint8Array {
  const out = new Uint8Array(data.length / 4)
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    out[j] = map.get(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)) ?? 0
  }
  return out
}

/** GIF's variable-width LZW, packed into 255-byte sub-blocks. */
function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1
  let codeSize = minCodeSize + 1
  let nextCode = eoiCode + 1
  let dict = new Map<string, number>()

  const out: number[] = []
  let bitBuffer = 0
  let bitCount = 0
  const emit = (code: number) => {
    bitBuffer |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xff)
      bitBuffer >>= 8
      bitCount -= 8
    }
  }

  emit(clearCode)
  let prefix = String(indices[0])
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const combined = `${prefix},${k}`
    if (dict.has(combined)) { prefix = combined; continue }
    emit(dict.has(prefix) ? dict.get(prefix)! : Number(prefix))
    dict.set(combined, nextCode++)
    if (nextCode > (1 << codeSize)) {
      if (codeSize < 12) codeSize++
      else {
        emit(clearCode)
        dict = new Map()
        codeSize = minCodeSize + 1
        nextCode = eoiCode + 1
      }
    }
    prefix = String(k)
  }
  emit(dict.has(prefix) ? dict.get(prefix)! : Number(prefix))
  emit(eoiCode)
  if (bitCount > 0) out.push(bitBuffer & 0xff)

  // Sub-blocks: a length byte then up to 255 bytes, terminated by a zero byte.
  const blocked: number[] = []
  for (let i = 0; i < out.length; i += 255) {
    const chunk = out.slice(i, i + 255)
    blocked.push(chunk.length, ...chunk)
  }
  blocked.push(0)
  return new Uint8Array(blocked)
}

export interface GifOptions {
  width: number
  height: number
  /** Hundredths of a second between frames, as GIF stores it. */
  delayCs: number
  colours: number
  loop: boolean
}

export function encodeGif(rgba: Uint8ClampedArray[], o: GifOptions): Blob {
  const { palette, map } = quantise(rgba, Math.min(256, Math.max(2, o.colours)))
  const frames: Frame[] = rgba.map((data) => ({ indices: toIndices(data, map), palette }))

  // Palette size must be a power of two; pad it out.
  let bits = 1
  while ((1 << bits) < palette.length) bits++
  const paletteSize = 1 << bits

  const bytes: number[] = []
  const push = (...v: number[]) => bytes.push(...v)
  const short = (v: number) => push(v & 0xff, (v >> 8) & 0xff)
  const ascii = (s: string) => push(...[...s].map((c) => c.charCodeAt(0)))

  ascii('GIF89a')
  short(o.width); short(o.height)
  push(0x80 | ((bits - 1) & 7), 0, 0)          // global colour table, sorted flag off
  for (let i = 0; i < paletteSize; i++) {
    const c = palette[i] ?? [0, 0, 0]
    push(c[0], c[1], c[2])
  }

  if (o.loop) {
    // NETSCAPE2.0 application extension — the only way to say "loop forever".
    push(0x21, 0xff, 11)
    ascii('NETSCAPE2.0')
    push(3, 1, 0, 0, 0)
  }

  for (const frame of frames) {
    push(0x21, 0xf9, 4, 0)                     // graphic control extension
    short(o.delayCs)
    push(0, 0)
    push(0x2c)                                 // image descriptor
    short(0); short(0); short(o.width); short(o.height)
    push(0)                                    // no local colour table
    const minCodeSize = Math.max(2, bits)
    push(minCodeSize)
    push(...lzwEncode(frame.indices, minCodeSize))
  }
  push(0x3b)                                   // trailer

  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' })
}
