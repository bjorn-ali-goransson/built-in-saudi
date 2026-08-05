// WAV encoding off the main thread (#154). Interleaving and 16-bit conversion
// touch every sample, so a 10-minute stereo track is ~50M writes — enough to
// visibly freeze the page if done inline. Channel data arrives as transferred
// ArrayBuffers, so nothing is copied on the way in, and the finished WAV is
// transferred back out.

export interface WavRequest {
  id: number
  channels: ArrayBuffer[]
  sampleRate: number
}
export interface WavResponse {
  id: number
  wav?: ArrayBuffer
  error?: string
}

function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const numCh = channels.length
  const frames = channels[0].length
  const blockAlign = numCh * 2
  const dataBytes = frames * blockAlign
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  const ascii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)          // PCM chunk size
  view.setUint16(20, 1, true)           // format: PCM
  view.setUint16(22, numCh, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)          // bits per sample
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      // Clamp before scaling: a sample slightly over 1.0 (which resampling and
      // fades can produce) would wrap to full-scale negative and click.
      const v = Math.max(-1, Math.min(1, channels[c][i]))
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      offset += 2
    }
  }
  return buffer
}

self.onmessage = (e: MessageEvent<WavRequest>) => {
  const { id, channels, sampleRate } = e.data
  try {
    const floats = channels.map((b) => new Float32Array(b))
    const wav = encodeWav(floats, sampleRate)
    const res: WavResponse = { id, wav }
    ;(self as unknown as Worker).postMessage(res, [wav])
  } catch (err) {
    const res: WavResponse = { id, error: String((err as Error)?.message ?? err) }
    ;(self as unknown as Worker).postMessage(res)
  }
}
