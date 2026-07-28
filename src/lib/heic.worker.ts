// HEIC decoding off the main thread (#226, #154). A 12MP iPhone photo is an HEVC
// intra-frame decode in wasm — hundreds of milliseconds — so doing it on the main
// thread would visibly freeze the page. The bitmap comes back as a transferable, so
// there's no copy.
import { decodeHeic } from './heicDecode'

export interface HeicRequest { id: number; file: File | Blob }
export interface HeicResponse { id: number; bitmap?: ImageBitmap; error?: string }

self.onmessage = async (e: MessageEvent<HeicRequest>) => {
  const { id, file } = e.data
  try {
    const bitmap = await decodeHeic(file)
    ;(self as unknown as Worker).postMessage({ id, bitmap } satisfies HeicResponse, [bitmap])
  } catch (err) {
    postMessage({ id, error: String((err as Error)?.message || err) } satisfies HeicResponse)
  }
}
