// "Has this password appeared in a breach?"
//
// Found by a web sweep of the privacy-tool market: metadata stripping and
// redaction are crowded and we ship both, but the one thing on every list that
// we could not answer was whether a password is already known. Entropy cannot
// tell you: `Tr0ub4dor&3` scores well and is in every wordlist there is.
//
// **The password never leaves the device**, and that is a property of the
// protocol rather than a promise. Have I Been Pwned's range API is built on
// k-anonymity:
//
//   1. SHA-1 the password, locally.
//   2. Send the first FIVE hex characters of the hash. Nothing else.
//   3. The server returns every suffix it holds under that prefix — about 800
//      of them — and the comparison happens here.
//
// So the service sees a 20-bit prefix shared by roughly a thousand hashes and
// cannot tell which one was asked about, or even whether the caller had a real
// password at all. That is a materially different claim from "we promise not to
// look", and it is the only reason this is acceptable on a site whose first
// principle is that nothing is uploaded.
//
// Two rules follow from it, and both are enforced in the tool rather than
// merely intended:
//
// - **It is never automatic.** A network call about a password must be a thing
//   the reader asks for, not something that happens because they typed. Same
//   rule the on-device AI tools follow for model downloads.
// - **The request is described before it is made**, in the UI, in both
//   languages. "Nothing is uploaded, except five characters of a hash" is the
//   honest sentence; leaving the network call unmentioned would not be.

/** Overridable in e2e so the spec can drive a mock rather than the real API. */
const ENDPOINT = () =>
  (typeof window !== 'undefined' && (window as unknown as { __HIBP?: string }).__HIBP)
  || 'https://api.pwnedpasswords.com/range/'

export type BreachResult =
  | { state: 'safe' }
  | { state: 'found'; count: number }
  | { state: 'error' }

async function sha1Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// There was a `hashPrefix` export here, added so the spec could assert what is
// actually sent. The spec never used it and asserted only the SHAPE — five hex
// characters — which a constant would satisfy. It now derives the expected
// prefix with Node's own SHA-1, which is stronger than importing ours, so the
// export has no reason to exist.

export async function checkBreached(password: string): Promise<BreachResult> {
  if (!password) return { state: 'safe' }
  try {
    const hash = await sha1Hex(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    // `Add-Padding` makes the service return a random number of decoy hashes,
    // so the SIZE of the response says nothing either. Without it the length of
    // a padded-free reply is itself a weak signal.
    const res = await fetch(ENDPOINT() + prefix, { headers: { 'Add-Padding': 'true' } })
    if (!res.ok) return { state: 'error' }
    const body = await res.text()
    for (const line of body.split('\n')) {
      const [suf, count] = line.trim().split(':')
      if (suf === suffix) {
        const n = Number(count)
        // A padding decoy is returned with a count of 0 and is not a match.
        return n > 0 ? { state: 'found', count: n } : { state: 'safe' }
      }
    }
    return { state: 'safe' }
  } catch {
    // Offline, blocked, or rate-limited. Saying so beats reporting "safe",
    // which is the one wrong answer this can give.
    return { state: 'error' }
  }
}
