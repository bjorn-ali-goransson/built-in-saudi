// libheif-js ships no types. Declared narrowly — only the surface heicDecode.ts
// actually uses — so a wrong assumption fails at compile time rather than at runtime
// in front of a user.
declare module 'libheif-js/wasm-bundle' {
  export interface HeifImage {
    get_width(): number
    get_height(): number
    display(data: ImageData, cb: (out: ImageData | null) => void): void
  }
  export class HeifDecoder {
    decode(buf: Uint8Array): HeifImage[]
  }
  const _default: { HeifDecoder: typeof HeifDecoder }
  export default _default
}
