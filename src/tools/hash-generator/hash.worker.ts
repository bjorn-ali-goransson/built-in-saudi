// Hashing runs in a Worker so large files never block the UI thread (#154).
// Files are passed as handles and read here; text is encoded here too.
export interface HashRequest { id: number; algo: string; data: File | string }
export interface HashResponse { id: number; hex: string; b64: string; error?: boolean }

self.onmessage = async (e: MessageEvent<HashRequest>) => {
  const { id, algo, data } = e.data
  try {
    const bytes = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(await data.arrayBuffer())
    const digest = new Uint8Array(await crypto.subtle.digest(algo, bytes))
    const hex = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
    let bin = ''
    for (const b of digest) bin += String.fromCharCode(b)
    postMessage({ id, hex, b64: btoa(bin) } satisfies HashResponse)
  } catch {
    postMessage({ id, hex: '', b64: '', error: true } satisfies HashResponse)
  }
}
