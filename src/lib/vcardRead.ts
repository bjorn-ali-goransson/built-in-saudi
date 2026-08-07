// Reading a .vcf — the inverse of tools/csv-vcard/vcard.ts.
//
// Exporting contacts from a phone is easy; doing anything with the result is
// not, because a .vcf is a stream of folded, escaped, sometimes
// quoted-printable-encoded lines. Four things have to be right before the text
// is even readable, and each one is a real export in the wild:
//
// - **Unfold first.** A line beginning with a space or tab continues the one
//   before it, and the fold lands at 75 *octets* — which for Arabic can be
//   mid-name. Parse before unfolding and you split people's names.
// - **vCard 2.1 quoted-printable.** Android's own exporter writes
//   `N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=D8=A3...` and continues a long
//   value with a trailing `=`. Left decoded-as-is, every Arabic contact from an
//   Android phone is gibberish — which is most contacts, here.
// - **Parameters come in three shapes.** `TEL;TYPE=CELL:`, the 2.1 shorthand
//   `TEL;CELL:`, and the quoted list `TEL;TYPE="CELL,VOICE":`. A naive split on
//   `:` also breaks on the colon inside `URL:https://…`, so only the FIRST
//   unquoted colon separates name from value.
// - **Apple prefixes properties with a group**: `item1.TEL:…`. Match on the
//   part after the dot or half of an iPhone export disappears.

export interface VCardContact {
  fullName: string
  firstName: string
  lastName: string
  phones: string[]
  emails: string[]
  org: string
  title: string
  address: string
  url: string
  note: string
  birthday: string
}

interface Prop { name: string; params: string[]; value: string }

/** Join continuation lines. RFC 6350 folds with a leading space or tab. */
export function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of raw) {
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1)
    // A vCard 2.1 quoted-printable value continues with a trailing '=' and the
    // next line is NOT indented — the only case where a fold has no marker of
    // its own on the continuation side.
    else if (out.length && /=$/.test(out[out.length - 1]) && /QUOTED-PRINTABLE/i.test(out[out.length - 1])) {
      out[out.length - 1] = out[out.length - 1].slice(0, -1) + line
    } else out.push(line)
  }
  return out
}

function decodeQuotedPrintable(s: string): string {
  const bytes: number[] = []
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9a-fA-F]{2}$/.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      // Anything not encoded is ASCII by definition of the encoding.
      for (const b of new TextEncoder().encode(s[i])) bytes.push(b)
    }
  }
  return new TextDecoder('utf-8').decode(Uint8Array.from(bytes))
}

function unescapeValue(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '\\') { out += s[i]; continue }
    const next = s[++i]
    out += next === 'n' || next === 'N' ? '\n' : (next ?? '')
  }
  return out
}

export function parseLine(line: string): Prop | null {
  // Find the first colon that is not inside a quoted parameter value.
  let colon = -1
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted
    else if (line[i] === ':' && !quoted) { colon = i; break }
  }
  if (colon < 0) return null
  const head = line.slice(0, colon)
  let value = line.slice(colon + 1)
  const bits = head.split(';')
  // Strip an Apple group prefix: item1.TEL -> TEL
  const name = (bits[0].includes('.') ? bits[0].slice(bits[0].indexOf('.') + 1) : bits[0]).toUpperCase()
  const params = bits.slice(1).map((p) => p.toUpperCase())

  if (params.some((p) => p.includes('QUOTED-PRINTABLE'))) value = decodeQuotedPrintable(value)
  return { name, params, value }
}

export function parseVcf(text: string): VCardContact[] {
  const out: VCardContact[] = []
  let cur: VCardContact | null = null

  for (const line of unfold(text)) {
    const t = line.trim()
    if (!t) continue
    if (/^BEGIN:VCARD$/i.test(t)) {
      cur = { fullName: '', firstName: '', lastName: '', phones: [], emails: [], org: '', title: '', address: '', url: '', note: '', birthday: '' }
      continue
    }
    if (/^END:VCARD$/i.test(t)) {
      if (cur) {
        if (!cur.fullName) cur.fullName = [cur.firstName, cur.lastName].filter(Boolean).join(' ')
        out.push(cur)
      }
      cur = null
      continue
    }
    if (!cur) continue

    const p = parseLine(line)
    if (!p) continue
    const v = unescapeValue(p.value).trim()
    if (!v) continue

    switch (p.name) {
      case 'FN': cur.fullName = v; break
      case 'N': {
        // family;given;middle;prefix;suffix — semicolons here are structure, so
        // they are split before unescaping, not after.
        const parts = p.value.split(/(?<!\\);/).map((x) => unescapeValue(x).trim())
        cur.lastName = parts[0] ?? ''
        cur.firstName = [parts[1], parts[2]].filter(Boolean).join(' ')
        break
      }
      case 'TEL': cur.phones.push(v); break
      case 'EMAIL': cur.emails.push(v); break
      case 'ORG': cur.org = v.split(/(?<!\\);/).map((x) => x.trim()).filter(Boolean).join(' — '); break
      case 'TITLE': cur.title = v; break
      case 'ADR': {
        // po;ext;street;locality;region;postcode;country — the empties are the
        // norm, so only the parts that carry anything are joined.
        const parts = p.value.split(/(?<!\\);/).map((x) => unescapeValue(x).trim())
        cur.address = parts.slice(2).filter(Boolean).join(', ')
        break
      }
      case 'URL': cur.url = v; break
      case 'NOTE': cur.note = v.replace(/\n/g, ' '); break
      case 'BDAY': cur.birthday = v; break
      // PHOTO/LOGO are base64 blobs that would swamp a spreadsheet, and the
      // rest (UID, REV, PRODID, X-*) is bookkeeping.
      default: break
    }
  }
  return out
}

/** Contacts → a rectangular table, widened to the most phones/emails present. */
export function contactsToRows(contacts: VCardContact[], locale: 'en' | 'ar'): string[][] {
  const maxPhones = Math.max(1, ...contacts.map((c) => c.phones.length))
  const maxEmails = Math.max(1, ...contacts.map((c) => c.emails.length))
  const L = locale === 'ar'
    ? { name: 'الاسم', first: 'الاسم الأول', last: 'اسم العائلة', phone: 'جوال', email: 'بريد', org: 'جهة العمل', title: 'المسمى', addr: 'العنوان', url: 'رابط', note: 'ملاحظة', bday: 'الميلاد' }
    : { name: 'Full name', first: 'First name', last: 'Last name', phone: 'Phone', email: 'Email', org: 'Organisation', title: 'Job title', addr: 'Address', url: 'Website', note: 'Note', bday: 'Birthday' }

  const header = [
    L.name, L.first, L.last,
    ...Array.from({ length: maxPhones }, (_, i) => (maxPhones > 1 ? `${L.phone} ${i + 1}` : L.phone)),
    ...Array.from({ length: maxEmails }, (_, i) => (maxEmails > 1 ? `${L.email} ${i + 1}` : L.email)),
    L.org, L.title, L.addr, L.url, L.bday, L.note,
  ]

  const rows = contacts.map((c) => [
    c.fullName, c.firstName, c.lastName,
    ...Array.from({ length: maxPhones }, (_, i) => c.phones[i] ?? ''),
    ...Array.from({ length: maxEmails }, (_, i) => c.emails[i] ?? ''),
    c.org, c.title, c.address, c.url, c.birthday, c.note,
  ])

  return [header, ...rows]
}
