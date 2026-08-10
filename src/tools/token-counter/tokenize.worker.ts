// Tokenizing off the main thread (#154).
//
// Two reasons, and the first is the one that decided it: the BPE ranks are a
// 2.2MB JavaScript module for o200k and 1.1MB for cl100k, so merely IMPORTING
// an encoder janks the page. The second is the encode itself, which is real
// work over a long document.
//
// The encoders are cached per encoding, so switching back and forth costs the
// download once.

export type Encoding = 'o200k' | 'cl100k'

export interface TokenReq { id: number; text: string; enc: Encoding }
export interface TokenRes { id: number; enc: Encoding; tokens: number; error?: string }

type Encoder = (text: string) => number[]
const cache: Partial<Record<Encoding, Encoder>> = {}

async function encoderFor(enc: Encoding): Promise<Encoder> {
  const hit = cache[enc]
  if (hit) return hit
  // Imported one encoding at a time and only on demand — the whole package
  // carries every encoding ever published, and we serve at most two.
  const mod = enc === 'o200k'
    ? await import('gpt-tokenizer/encoding/o200k_base')
    : await import('gpt-tokenizer/encoding/cl100k_base')
  const fn = mod.encode as Encoder
  cache[enc] = fn
  return fn
}

self.onmessage = async (e: MessageEvent<TokenReq>) => {
  const { id, text, enc } = e.data
  try {
    const encode = await encoderFor(enc)
    const out: TokenRes = { id, enc, tokens: text ? encode(text).length : 0 }
    ;(self as unknown as Worker).postMessage(out)
  } catch (err) {
    const out: TokenRes = { id, enc, tokens: 0, error: String(err) }
    ;(self as unknown as Worker).postMessage(out)
  }
}
