import { describe, expect, it } from 'vitest'
import { fingerprintOf, safetyCode } from './safety'

const sdp = (fp: string) => `v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=fingerprint:sha-256 ${fp}\r\na=setup:actpass\r\n`
const A = 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89'
const B = '10:32:54:76:98:BA:DC:FE:10:32:54:76:98:BA:DC:FE:10:32:54:76:98:BA:DC:FE:10:32:54:76:98:BA:DC:FE'
const M = '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF'

describe('call safety code', () => {
  it('reads the fingerprint out of an SDP, case-folded', () => {
    expect(fingerprintOf(sdp(A.toLowerCase()))).toBe(`sha-256 ${A}`)
    expect(fingerprintOf('v=0\r\n')).toBeNull()
    expect(fingerprintOf(undefined)).toBeNull()
  })

  it('both ends compute the same code', async () => {
    const a = await safetyCode(`sha-256 ${A}`, `sha-256 ${B}`)
    expect(a).toMatch(/^\d{4} \d{4} \d{4} \d{4}$/)
    expect(await safetyCode(`sha-256 ${B}`, `sha-256 ${A}`)).toBe(a)
  })

  it('a relay that swapped in its own certificate shows each side a different code', async () => {
    // Alice talks to the relay (A, M); Bob talks to the relay (M, B).
    expect(await safetyCode(`sha-256 ${A}`, `sha-256 ${M}`)).not.toBe(await safetyCode(`sha-256 ${M}`, `sha-256 ${B}`))
  })
})
