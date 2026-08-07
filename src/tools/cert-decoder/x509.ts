import { TAG, derString, derTime, hex, oidToString, parseDer, type Node } from './asn1'

// Reading an X.509 certificate.
//
// The structure is fixed by RFC 5280:
//   Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
//   TBSCertificate ::= SEQUENCE { [0] version, serialNumber, signature, issuer,
//                                 validity, subject, subjectPublicKeyInfo,
//                                 ... [3] extensions }
// The version tag is optional and context-specific, so every field after it
// shifts by one when it is absent — which is exactly how a decoder ends up
// printing the issuer as the subject.

export interface Name { oid: string; label: string; value: string }

export interface Extension {
  oid: string
  name: string
  critical: boolean
  value: string
}

export interface Certificate {
  version: number
  serial: string
  subject: Name[]
  issuer: Name[]
  notBefore: Date | null
  notAfter: Date | null
  signatureAlgorithm: string
  publicKeyAlgorithm: string
  publicKeyBits: number | null
  extensions: Extension[]
  san: string[]
  selfSigned: boolean
  /** SHA-256 over the whole DER, as every tool and browser reports it. */
  fingerprint: string
}

const OIDS: Record<string, string> = {
  '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST',
  '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.5': 'serialNumber',
  '2.5.4.4': 'SN', '2.5.4.42': 'GN', '2.5.4.12': 'title',
  '1.2.840.113549.1.9.1': 'emailAddress', '0.9.2342.19200300.100.1.25': 'DC',
}

const SIG_ALGS: Record<string, string> = {
  '1.2.840.113549.1.1.5': 'SHA-1 with RSA',
  '1.2.840.113549.1.1.11': 'SHA-256 with RSA',
  '1.2.840.113549.1.1.12': 'SHA-384 with RSA',
  '1.2.840.113549.1.1.13': 'SHA-512 with RSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.4.3.2': 'ECDSA with SHA-256',
  '1.2.840.10045.4.3.3': 'ECDSA with SHA-384',
  '1.3.101.112': 'Ed25519',
}

const KEY_ALGS: Record<string, string> = {
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.10045.2.1': 'EC',
  '1.3.101.112': 'Ed25519',
}

const EXT_NAMES: Record<string, string> = {
  '2.5.29.15': 'Key usage',
  '2.5.29.17': 'Subject alternative names',
  '2.5.29.19': 'Basic constraints',
  '2.5.29.14': 'Subject key identifier',
  '2.5.29.35': 'Authority key identifier',
  '2.5.29.31': 'CRL distribution points',
  '2.5.29.32': 'Certificate policies',
  '2.5.29.37': 'Extended key usage',
  '1.3.6.1.5.5.7.1.1': 'Authority information access',
  '1.3.6.1.4.1.11129.2.4.2': 'Certificate transparency',
}

const KEY_USAGE = [
  'digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment',
  'keyAgreement', 'keyCertSign', 'cRLSign', 'encipherOnly', 'decipherOnly',
]

const EKU: Record<string, string> = {
  '1.3.6.1.5.5.7.3.1': 'TLS server', '1.3.6.1.5.5.7.3.2': 'TLS client',
  '1.3.6.1.5.5.7.3.3': 'Code signing', '1.3.6.1.5.5.7.3.4': 'Email',
  '1.3.6.1.5.5.7.3.8': 'Timestamping', '1.3.6.1.5.5.7.3.9': 'OCSP signing',
}

function readName(seq: Node): Name[] {
  const out: Name[] = []
  for (const rdn of seq.children) {
    for (const pair of rdn.children) {
      const [oidNode, valueNode] = pair.children
      if (!oidNode || !valueNode) continue
      const oid = oidToString(oidNode.value)
      out.push({ oid, label: OIDS[oid] ?? oid, value: derString(valueNode) })
    }
  }
  return out
}

export const nameToString = (n: Name[]) => n.map((p) => `${p.label}=${p.value}`).join(', ')

function readSan(value: Uint8Array): string[] {
  const [seq] = parseDer(value)
  if (!seq) return []
  const dec = new TextDecoder()
  return seq.children.map((n) => {
    // GeneralName is a CHOICE of context-specific tags: 2 is dNSName, 7 is an
    // IP packed as raw bytes, 1 rfc822Name, 6 URI.
    switch (n.num) {
      case 2: return dec.decode(n.value)
      case 1: return dec.decode(n.value)
      case 6: return dec.decode(n.value)
      case 7: return n.value.length === 4
        ? [...n.value].join('.')
        : [...n.value].map((b) => b.toString(16).padStart(2, '0')).join(':').replace(/(..):(..)/g, '$1$2:').replace(/:$/, '')
      default: return ''
    }
  }).filter(Boolean)
}

function readExtension(oid: string, value: Uint8Array): string {
  const [inner] = parseDer(value)
  if (oid === '2.5.29.17') return readSan(value).join(', ')
  if (oid === '2.5.29.19') {
    const ca = inner?.children.find((c) => c.num === TAG.BOOLEAN)
    return ca && ca.value[0] ? 'Certificate authority' : 'Not a CA'
  }
  if (oid === '2.5.29.15' && inner) {
    // BIT STRING: first content byte is the count of unused trailing bits.
    const bits = inner.value.subarray(1)
    const unused = inner.value[0] ?? 0
    const total = bits.length * 8 - unused
    const set: string[] = []
    for (let i = 0; i < total && i < KEY_USAGE.length; i++) {
      if (bits[i >> 3] & (0x80 >> (i & 7))) set.push(KEY_USAGE[i])
    }
    return set.join(', ')
  }
  if (oid === '2.5.29.37' && inner) {
    return inner.children.map((c) => { const o = oidToString(c.value); return EKU[o] ?? o }).join(', ')
  }
  if (oid === '2.5.29.14' && inner) return hex(inner.value, ':')
  return hex(value.subarray(0, 32), ':') + (value.length > 32 ? '…' : '')
}

export async function parseCertificate(der: Uint8Array): Promise<Certificate> {
  const [cert] = parseDer(der)
  if (!cert || cert.num !== TAG.SEQUENCE || cert.children.length < 3) throw new Error('not-a-certificate')
  const [tbs, sigAlg] = cert.children
  if (!tbs || tbs.num !== TAG.SEQUENCE) throw new Error('not-a-certificate')

  // [0] EXPLICIT version is optional. Without it the certificate is v1 and
  // every subsequent field sits one position earlier — the classic off-by-one
  // that makes a decoder print the issuer where the subject belongs.
  let i = 0
  let version = 1
  if (tbs.children[0]?.cls === 2 && tbs.children[0]?.num === 0) {
    version = (tbs.children[0].children[0]?.value[0] ?? 0) + 1
    i = 1
  }
  const serialNode = tbs.children[i++]
  i++ // inner signature algorithm, repeated outside; the outer one is canonical
  const issuerNode = tbs.children[i++]
  const validityNode = tbs.children[i++]
  const subjectNode = tbs.children[i++]
  const spkiNode = tbs.children[i++]

  const issuer = issuerNode ? readName(issuerNode) : []
  const subject = subjectNode ? readName(subjectNode) : []

  const notBefore = validityNode?.children[0] ? derTime(validityNode.children[0]) : null
  const notAfter = validityNode?.children[1] ? derTime(validityNode.children[1]) : null

  const keyOid = spkiNode?.children[0]?.children[0]
    ? oidToString(spkiNode.children[0].children[0].value) : ''
  let publicKeyBits: number | null = null
  if (KEY_ALGS[keyOid] === 'RSA' && spkiNode?.children[1]) {
    // The key bit string wraps a SEQUENCE { modulus, exponent }; the modulus
    // carries a leading zero byte when its top bit is set, which must not be
    // counted or every RSA key reads as 8 bits too large.
    const [inner] = parseDer(spkiNode.children[1].value.subarray(1))
    const modulus = inner?.children[0]?.value
    if (modulus) publicKeyBits = (modulus[0] === 0 ? modulus.length - 1 : modulus.length) * 8
  } else if (KEY_ALGS[keyOid] === 'EC' && spkiNode?.children[1]) {
    publicKeyBits = (spkiNode.children[1].value.length - 2) * 4
  }

  const extensions: Extension[] = []
  const extHolder = tbs.children.find((c) => c.cls === 2 && c.num === 3)
  for (const ext of extHolder?.children[0]?.children ?? []) {
    const oidNode = ext.children[0]
    if (!oidNode) continue
    const oid = oidToString(oidNode.value)
    const critical = ext.children.some((c) => c.num === TAG.BOOLEAN && c.value[0] !== 0)
    const octet = ext.children.find((c) => c.num === TAG.OCTET_STRING)
    extensions.push({
      oid,
      name: EXT_NAMES[oid] ?? oid,
      critical,
      value: octet ? readExtension(oid, octet.value) : '',
    })
  }

  const sigOid = sigAlg?.children[0] ? oidToString(sigAlg.children[0].value) : ''
  const digest = await crypto.subtle.digest('SHA-256', der.subarray(0) as BufferSource)

  return {
    version,
    serial: serialNode ? hex(serialNode.value.length > 1 && serialNode.value[0] === 0 ? serialNode.value.subarray(1) : serialNode.value) : '',
    subject,
    issuer,
    notBefore,
    notAfter,
    signatureAlgorithm: SIG_ALGS[sigOid] ?? sigOid,
    publicKeyAlgorithm: KEY_ALGS[keyOid] ?? keyOid,
    publicKeyBits,
    extensions,
    san: extensions.find((e) => e.oid === '2.5.29.17')?.value.split(', ').filter(Boolean) ?? [],
    selfSigned: nameToString(issuer) === nameToString(subject) && issuer.length > 0,
    fingerprint: hex(new Uint8Array(digest), ':'),
  }
}

export function daysUntil(d: Date | null, now = new Date()): number | null {
  if (!d) return null
  return Math.floor((d.getTime() - now.getTime()) / 86400000)
}
