import { parse as parsePhone } from '../saudi-phone/phone'

// Turning a spreadsheet of people into contacts your phone will accept.
//
// The "300 contacts stuck in a spreadsheet" problem. Three things decide whether
// the result actually imports:
//
// 1. **N as well as FN.** FN is the display name; N is the structured one
//    (family;given;middle;prefix;suffix). Several address books — iOS among
//    them — sort and merge on N, so a file with only FN imports as a pile of
//    contacts with no surnames and no sort order.
// 2. **Folding and escaping**, exactly as in .ics: 75-octet lines, and commas,
//    semicolons and backslashes escaped. An Arabic name hits the fold limit in
//    half the characters.
// 3. **Phone numbers in E.164.** `0512345678` is meaningless once the phone
//    leaves the country; `+966512345678` always works. Saudi numbers are
//    normalised, and anything unrecognised is passed through untouched rather
//    than mangled into a wrong number.

export type Field = 'firstName' | 'lastName' | 'fullName' | 'phone' | 'phone2' | 'email' | 'org' | 'title' | 'address' | 'note' | 'url' | 'ignore'

export const FIELDS: Field[] = ['ignore', 'fullName', 'firstName', 'lastName', 'phone', 'phone2', 'email', 'org', 'title', 'address', 'url', 'note']

/** Header text a column of each kind usually carries, English and Arabic. */
const HINTS: Record<Exclude<Field, 'ignore'>, RegExp> = {
  fullName: /^(full ?name|name|contact|الاسم|اسم)$/i,
  firstName: /(first|given|fore).*name|^first$|الاسم الأول|الاسم الاول/i,
  lastName: /(last|family|sur).*name|^last$|اسم العائلة|العائلة|اللقب/i,
  phone: /(mobile|phone|tel|cell|jawal|جوال|هاتف|جوّال|رقم)/i,
  phone2: /(phone ?2|second|alt|other|بديل|آخر)/i,
  email: /(e-?mail|بريد|ايميل|إيميل)/i,
  org: /(company|organi[sz]ation|employer|شركة|جهة|مؤسسة)/i,
  title: /(job|title|position|role|المسمى|وظيفة|المنصب)/i,
  address: /(address|street|city|عنوان|مدينة|شارع)/i,
  url: /(website|url|site|موقع|رابط)/i,
  note: /(note|comment|ملاحظ|تعليق)/i,
}

/** Best guess at what each column is, from its header. */
export function guessMapping(headers: string[]): Field[] {
  const used = new Set<Field>()
  return headers.map((h) => {
    const clean = h.trim()
    for (const [field, re] of Object.entries(HINTS) as [Exclude<Field, 'ignore'>, RegExp][]) {
      if (used.has(field)) continue
      if (re.test(clean)) { used.add(field); return field }
    }
    return 'ignore' as Field
  })
}

export function escapeText(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fold to 75 octets with a leading space, counted in UTF-8 bytes. */
export function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let bytes = 0
  let limit = 75
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (bytes + n > limit) { out.push(cur); cur = ''; bytes = 0; limit = 74 }
    cur += ch
    bytes += n
  }
  if (cur) out.push(cur)
  return out[0] + out.slice(1).map((l) => `\r\n ${l}`).join('')
}

/**
 * Saudi numbers to E.164; everything else left exactly as typed.
 *
 * Guessing at a foreign number's country is how a contact list ends up dialling
 * the wrong country — better an unnormalised number that still works locally.
 */
export function normalisePhone(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^\+/.test(t)) return t.replace(/[^\d+]/g, '')
  const p = parsePhone(t)
  return p.kind === 'invalid' ? t : p.e164
}

export interface Contact {
  fullName: string
  firstName: string
  lastName: string
  phones: string[]
  email: string
  org: string
  title: string
  address: string
  url: string
  note: string
}

export function rowToContact(row: string[], mapping: Field[]): Contact {
  const get = (f: Field) => {
    const i = mapping.indexOf(f)
    return i >= 0 ? (row[i] ?? '').trim() : ''
  }
  const first = get('firstName')
  const last = get('lastName')
  const full = get('fullName') || [first, last].filter(Boolean).join(' ')
  // When only a full name is given, the LAST word is taken as the family name —
  // right for most of the world, and the alternative (no N at all) is worse than
  // an imperfect split.
  let f = first
  let l = last
  if (!f && !l && full) {
    const parts = full.split(/\s+/)
    l = parts.length > 1 ? parts[parts.length - 1] : ''
    f = parts.slice(0, parts.length > 1 ? -1 : 1).join(' ')
  }
  return {
    fullName: full,
    firstName: f,
    lastName: l,
    phones: [get('phone'), get('phone2')].map(normalisePhone).filter(Boolean),
    email: get('email'),
    org: get('org'),
    title: get('title'),
    address: get('address'),
    url: get('url'),
    note: get('note'),
  }
}

export function buildVcard(c: Contact): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0']
  // N is structured: family;given;middle;prefix;suffix.
  lines.push(`N:${escapeText(c.lastName)};${escapeText(c.firstName)};;;`)
  lines.push(`FN:${escapeText(c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' '))}`)
  if (c.org) lines.push(`ORG:${escapeText(c.org)}`)
  if (c.title) lines.push(`TITLE:${escapeText(c.title)}`)
  c.phones.forEach((p, i) => lines.push(`TEL;TYPE=${i === 0 ? 'CELL' : 'VOICE'}:${p}`))
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeText(c.email)}`)
  if (c.address) lines.push(`ADR;TYPE=HOME:;;${escapeText(c.address)};;;;`)
  if (c.url) lines.push(`URL:${escapeText(c.url)}`)
  if (c.note) lines.push(`NOTE:${escapeText(c.note)}`)
  lines.push('END:VCARD')
  return lines.map(fold).join('\r\n')
}

export function buildAll(contacts: Contact[]): string {
  return contacts.map(buildVcard).join('\r\n') + '\r\n'
}

/** A contact with no name at all cannot be imported; report rather than drop. */
export const isUsable = (c: Contact) => !!(c.fullName || c.firstName || c.lastName)
