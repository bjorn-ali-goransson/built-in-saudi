// Saudi phone number parsing. The national significant number is always 9
// digits: a mobile starts with 5, a landline with 1 (written 05… / 01… with the
// trunk 0, or +966 5… / +966 1… internationally).

export type Kind = 'mobile' | 'landline' | 'shortcode' | 'invalid'

export interface Parsed {
  raw: string
  kind: Kind
  /** 9-digit national significant number, no trunk 0. */
  nsn: string
  e164: string          // +9665XXXXXXXX
  national: string      // 05X XXX XXXX
  international: string // +966 5X XXX XXXX
  dialable: string      // tel: href
  whatsapp: string      // wa.me link (mobile only)
  /** Area name for a landline, or the operator a mobile prefix was allocated to. */
  region?: string
  operator?: string
  reason?: string       // why it's invalid
}

// Landline area codes. Stable, unlike mobile prefixes.
const AREAS: Record<string, { en: string; ar: string }> = {
  '11': { en: 'Riyadh region', ar: 'منطقة الرياض' },
  '12': { en: 'Makkah region — Jeddah, Makkah, Taif', ar: 'منطقة مكة — جدة ومكة والطائف' },
  '13': { en: 'Eastern Province — Dammam, Khobar, Jubail', ar: 'المنطقة الشرقية — الدمام والخبر والجبيل' },
  '14': { en: 'Madinah & Tabuk region — Yanbu, Al-Ula', ar: 'منطقتا المدينة وتبوك — ينبع والعلا' },
  '16': { en: 'Qassim & Hail region — Buraidah, Majmaah', ar: 'منطقتا القصيم وحائل — بريدة والمجمعة' },
  '17': { en: 'Southern region — Abha, Jazan, Najran, Al-Baha', ar: 'المنطقة الجنوبية — أبها وجازان ونجران والباحة' },
}

// Original allocations. Numbers are portable in Saudi Arabia, so this says who
// the prefix was ISSUED to — not necessarily who runs the number today. The UI
// has to say so; quietly presenting it as "the operator" would be wrong.
const OPERATORS: Record<string, { en: string; ar: string }> = {
  '50': { en: 'stc', ar: 'إس تي سي' },
  '53': { en: 'stc', ar: 'إس تي سي' },
  '55': { en: 'stc', ar: 'إس تي سي' },
  '54': { en: 'Mobily', ar: 'موبايلي' },
  '56': { en: 'Mobily', ar: 'موبايلي' },
  '58': { en: 'Zain', ar: 'زين' },
  '59': { en: 'Zain', ar: 'زين' },
  '57': { en: 'MVNO (Virgin, Lebara)', ar: 'مشغّل افتراضي (فيرجن، ليبارا)' },
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** Keep only digits, folding Arabic-Indic and Persian shapes to Western first. */
function digits(s: string): string {
  let out = ''
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') { out += ch; continue }
    const a = AR_DIGITS.indexOf(ch); if (a >= 0) { out += a; continue }
    const f = FA_DIGITS.indexOf(ch); if (f >= 0) { out += f; continue }
  }
  return out
}

function group(nsn: string): string {
  // 5XXXXXXXX → 05X XXX XXXX ; 1XXXXXXXX → 01X XXX XXXX
  return `0${nsn.slice(0, 2)} ${nsn.slice(2, 5)} ${nsn.slice(5)}`
}

export function parse(raw: string, locale: 'en' | 'ar' = 'en'): Parsed {
  const bad = (reason: string, kind: Kind = 'invalid'): Parsed => ({
    raw, kind, nsn: '', e164: '', national: '', international: '', dialable: '', whatsapp: '', reason,
  })
  let d = digits(raw)
  if (!d) return bad(locale === 'ar' ? 'لا توجد أرقام.' : 'No digits found.')

  // Peel the international prefixes, then the trunk 0.
  if (d.startsWith('00966')) d = d.slice(5)
  else if (d.startsWith('966')) d = d.slice(3)
  if (d.startsWith('0')) d = d.slice(1)

  // 4-digit service numbers (900, 997, 1966…) aren't NSNs — flag rather than fail.
  if (d.length <= 4 && (d.startsWith('9') || d.startsWith('1'))) {
    return { ...bad('', 'shortcode'), nsn: d, national: d, dialable: `tel:${d}`,
      reason: locale === 'ar' ? 'رقم خدمة قصير، وليس رقمًا وطنيًا.' : 'A short service number, not a national number.' }
  }
  if (d.length < 9) return bad(locale === 'ar' ? `ناقص — ${d.length} أرقام من ٩.` : `Too short — ${d.length} digits of 9.`)
  if (d.length > 9) return bad(locale === 'ar' ? `زائد — ${d.length} أرقام من ٩.` : `Too long — ${d.length} digits, expected 9.`)

  const kind: Kind = d[0] === '5' ? 'mobile' : d[0] === '1' ? 'landline' : 'invalid'
  if (kind === 'invalid') {
    return bad(locale === 'ar'
      ? 'الرقم الوطني يبدأ بـ٥ (جوال) أو ١ (أرضي).'
      : 'A national number starts with 5 (mobile) or 1 (landline).')
  }

  const e164 = `+966${d}`
  const prefix = d.slice(0, 2)
  const out: Parsed = {
    raw, kind, nsn: d, e164,
    national: group(d),
    international: `+966 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`,
    dialable: `tel:${e164}`,
    whatsapp: kind === 'mobile' ? `https://wa.me/966${d}` : '',
  }
  if (kind === 'landline') {
    const area = AREAS[prefix]
    if (!area) {
      return bad(locale === 'ar' ? `مفتاح المنطقة ${prefix} غير مستخدم.` : `Area code ${prefix} is not in use.`)
    }
    out.region = area[locale]
  } else {
    out.operator = OPERATORS[prefix]?.[locale]
    if (!out.operator) {
      // 051 is reserved; anything else unknown is still structurally valid.
      out.operator = locale === 'ar' ? 'غير مخصّص' : 'unallocated'
    }
  }
  return out
}

/** Parse a pasted list — one number per line, or comma/semicolon separated. */
export function parseMany(text: string, locale: 'en' | 'ar' = 'en'): Parsed[] {
  return text
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parse(l, locale))
}
