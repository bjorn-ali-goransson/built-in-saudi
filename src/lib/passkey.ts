// Passkey ceremonies in the browser, for a server running @simplewebauthn/server.
//
// The server sends its options as JSON (binary fields base64url) and expects
// the credential back as JSON. Chromium has PublicKeyCredential.parse*FromJSON
// and credential.toJSON(), Safari before 18 does not, so this converts by hand
// rather than depending on either, or on @simplewebauthn/browser for twenty
// lines of it.

type Json = Record<string, unknown>

const toB64u = (buf: ArrayBuffer | ArrayBufferView): string => {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64u = (s: string): ArrayBuffer => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}
const descriptors = (list: unknown) =>
  (Array.isArray(list) ? list : []).map((c: Json) => ({ ...c, id: fromB64u(String(c.id)) })) as PublicKeyCredentialDescriptor[]

export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && !!navigator.credentials
}

/** The user dismissed the device's prompt (or it timed out): not an error to show. */
export function passkeyCancelled(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')
}

/** navigator.credentials.create from the server's registration options. */
export async function createPasskey(options: Json): Promise<Json> {
  const user = options.user as Json
  const publicKey = {
    ...options,
    challenge: fromB64u(String(options.challenge)),
    user: { ...user, id: fromB64u(String(user.id)) },
    excludeCredentials: descriptors(options.excludeCredentials),
  } as unknown as PublicKeyCredentialCreationOptions
  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null
  if (!cred) throw new DOMException('no credential', 'NotAllowedError')
  const r = cred.response as AuthenticatorAttestationResponse
  return {
    id: cred.id,
    rawId: toB64u(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64u(r.clientDataJSON),
      attestationObject: toB64u(r.attestationObject),
      transports: typeof r.getTransports === 'function' ? r.getTransports() : [],
    },
  }
}

/** navigator.credentials.get from the server's authentication options. */
export async function getPasskey(options: Json): Promise<Json> {
  const publicKey = {
    ...options,
    challenge: fromB64u(String(options.challenge)),
    allowCredentials: descriptors(options.allowCredentials),
  } as unknown as PublicKeyCredentialRequestOptions
  const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null
  if (!cred) throw new DOMException('no credential', 'NotAllowedError')
  const r = cred.response as AuthenticatorAssertionResponse
  return {
    id: cred.id,
    rawId: toB64u(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64u(r.clientDataJSON),
      authenticatorData: toB64u(r.authenticatorData),
      signature: toB64u(r.signature),
      userHandle: r.userHandle ? toB64u(r.userHandle) : undefined,
    },
  }
}
