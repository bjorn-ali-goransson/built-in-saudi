import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon } from '../../components/icons'

// Saudi bank identifiers (the 2-digit bank code in the IBAN, positions 5–6).
// Best-effort reference for the major banks; always shown alongside the raw code.
const SA_BANKS: Record<string, { en: string; ar: string }> = {
  '80': { en: 'Al Rajhi Bank', ar: 'مصرف الراجحي' },
  '10': { en: 'Saudi National Bank (SNB)', ar: 'البنك الأهلي السعودي' },
  '40': { en: 'Samba (now SNB)', ar: 'سامبا (الأهلي)' },
  '20': { en: 'Riyad Bank', ar: 'بنك الرياض' },
  '45': { en: 'SABB', ar: 'البنك السعودي البريطاني' },
  '30': { en: 'Arab National Bank', ar: 'البنك العربي الوطني' },
  '55': { en: 'Banque Saudi Fransi', ar: 'البنك السعودي الفرنسي' },
  '60': { en: 'Bank Aljazira', ar: 'بنك الجزيرة' },
  '65': { en: 'Saudi Investment Bank', ar: 'البنك السعودي للاستثمار' },
  '05': { en: 'Alinma Bank', ar: 'مصرف الإنماء' },
  '15': { en: 'Bank Albilad', ar: 'بنك البلاد' },
}

function mod97(iban: string): number {
  const s = iban.slice(4) + iban.slice(0, 4)
  let rem = 0
  for (const ch of s) {
    const code = ch.charCodeAt(0)
    const chunk = code >= 65 && code <= 90 ? String(code - 55) : ch // A→10 … Z→35
    for (const d of chunk) rem = (rem * 10 + (d.charCodeAt(0) - 48)) % 97
  }
  return rem
}

interface Check { valid: boolean; reason?: 'length' | 'checksum' | 'structure'; bankCode?: string }
function check(raw: string): Check | null {
  const iban = raw.replace(/\s+/g, '').toUpperCase()
  if (!iban) return null
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return { valid: false, reason: 'structure' }
  if (iban.startsWith('SA') && iban.length !== 24) return { valid: false, reason: 'length' }
  if (mod97(iban) !== 1) return { valid: false, reason: 'checksum' }
  return { valid: true, bankCode: iban.startsWith('SA') ? iban.slice(4, 6) : undefined }
}

const STR = {
  en: {
    placeholder: 'SA03 8000 0000 6080 1016 7519', label: 'IBAN',
    valid: 'Valid IBAN', invalid: 'Invalid IBAN',
    reasons: { length: 'A Saudi IBAN must be SA + 22 digits (24 characters).', checksum: 'The checksum failed — check for a typo.', structure: 'Not a valid IBAN format.' } as Record<string, string>,
    bank: 'Bank', code: 'code', unknown: 'Unrecognised code — verify with your bank',
    copy: 'Copy', copied: 'Copied!', privacy: 'Checked in your browser — the IBAN is never sent anywhere.',
  },
  ar: {
    placeholder: 'SA03 8000 0000 6080 1016 7519', label: 'رقم الآيبان',
    valid: 'آيبان صحيح', invalid: 'آيبان غير صحيح',
    reasons: { length: 'الآيبان السعودي = SA + ٢٢ رقمًا (٢٤ خانة).', checksum: 'فشل التحقق — راجع الأرقام.', structure: 'صيغة الآيبان غير صحيحة.' } as Record<string, string>,
    bank: 'البنك', code: 'الرمز', unknown: 'رمز غير معروف — تحقّق من بنكك',
    copy: 'نسخ', copied: 'تم النسخ!', privacy: 'يُفحص داخل متصفحك — لا يُرسل الآيبان إلى أي مكان.',
  },
}

export default function IbanValidatorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('')
  const [copied, setCopied] = useState(false)

  const res = useMemo(() => check(raw), [raw])
  const formatted = raw.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim()

  async function copy() {
    try { await navigator.clipboard.writeText(formatted); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const bank = res?.bankCode ? SA_BANKS[res.bankCode] : undefined

  return (
    <div className="stack" data-testid="iban-validator">
      <label className="field">
        <span className="field__label">{s.label}</span>
        <input className="input font-mono text-[1.05rem] tracking-wide" dir="ltr" data-testid="iban-input"
          placeholder={s.placeholder} value={raw} spellCheck={false} onChange={(e) => setRaw(e.target.value)} autoComplete="off" />
      </label>

      {res && (
        <div className="flex flex-col gap-3">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-md font-semibold ${res.valid ? 'bg-[color-mix(in_srgb,var(--green-400)_14%,transparent)] text-green-700' : 'bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[color:var(--danger)]'}`} data-testid="iban-status">
            <span aria-hidden="true">{res.valid ? '✓' : '✕'}</span>
            {res.valid ? s.valid : s.invalid}
          </div>

          {res.valid ? (
            <>
              <code className="font-mono text-[1.1rem] tracking-wide break-all bg-sand-100 border border-[color:var(--line-soft)] rounded-md px-4 py-3 text-green-700" dir="ltr" data-testid="iban-formatted">{formatted}</code>
              {res.bankCode && (
                <p className="text-ink-soft" data-testid="iban-bank">
                  <span className="text-ink-faint">{s.bank}:</span> {bank ? (locale === 'ar' ? bank.ar : bank.en) : s.unknown} <span className="text-ink-faint font-mono">({s.code} {res.bankCode})</span>
                </p>
              )}
              <button className="btn self-start" data-testid="iban-copy" onClick={copy}><CopyIcon /> {copied ? s.copied : s.copy}</button>
            </>
          ) : (
            <p className="text-ink-soft text-[0.95rem]">{s.reasons[res.reason || 'structure']}</p>
          )}
        </div>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </div>
  )
}
