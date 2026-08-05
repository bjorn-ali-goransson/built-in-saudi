import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, PhoneIcon } from '../../components/icons'
import { Button, Input, Textarea, Stack, Seg, SegButton, Panel } from '../../components/ui'
import { parse, parseMany, type Parsed } from './phone'

const STR = {
  en: {
    one: 'One number', many: 'A list',
    placeholder: '0501234567, +966 50 123 4567, 966501234567…',
    listPlaceholder: 'Paste numbers — one per line, or separated by commas…',
    valid: 'Valid', invalid: 'Not a valid Saudi number', short: 'Service number',
    mobile: 'Mobile', landline: 'Landline',
    e164: 'International (E.164)', national: 'National', intl: 'International, spaced',
    operator: 'Prefix issued to', region: 'Area',
    call: 'Call', whatsapp: 'WhatsApp', copy: 'Copy', copied: 'Copied!',
    portNote: 'Numbers are portable in Saudi Arabia, so the prefix tells you who it was issued to — not necessarily who runs it today.',
    hint: 'Type a Saudi number in any shape — with or without +966, the leading zero, spaces, dashes or Arabic-Indic digits. You get every standard format back.',
    summary: (ok: number, total: number) => `${ok} of ${total} valid`,
    copyAll: 'Copy all as E.164', copyValid: 'Copy the valid ones',
  },
  ar: {
    one: 'رقم واحد', many: 'قائمة',
    placeholder: '٠٥٠١٢٣٤٥٦٧، +966 50 123 4567، 966501234567…',
    listPlaceholder: 'الصق الأرقام — رقمًا في كل سطر، أو مفصولة بفواصل…',
    valid: 'صالح', invalid: 'ليس رقمًا سعوديًا صالحًا', short: 'رقم خدمة',
    mobile: 'جوال', landline: 'أرضي',
    e164: 'دولي (E.164)', national: 'محلي', intl: 'دولي بمسافات',
    operator: 'المقدّمة مخصّصة لـ', region: 'المنطقة',
    call: 'اتصال', whatsapp: 'واتساب', copy: 'نسخ', copied: 'تم النسخ!',
    portNote: 'الأرقام قابلة للنقل بين المشغّلين في السعودية، لذا تدلّ المقدّمة على الجهة التي خُصِّصت لها — لا بالضرورة مشغّل الرقم اليوم.',
    hint: 'اكتب رقمًا سعوديًا بأي صيغة — بـ+966 أو بدونه، بالصفر أو بدونه، بمسافات أو شرطات أو أرقام هندية. تحصل على كل الصيغ القياسية.',
    summary: (ok: number, total: number) => `${ok.toLocaleString('ar')} من ${total.toLocaleString('ar')} صالح`,
    copyAll: 'انسخ الكل بصيغة E.164', copyValid: 'انسخ الصالحة',
  },
}

export default function SaudiPhoneTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [mode, setMode] = useState<'one' | 'many'>('one')
  const [single, setSingle] = useState('')
  const [list, setList] = useState('')
  const [copied, setCopied] = useState('')

  const one = useMemo(() => (single.trim() ? parse(single, locale) : null), [single, locale])
  const many = useMemo(() => (mode === 'many' ? parseMany(list, locale) : []), [list, mode, locale])
  const okCount = many.filter((p) => p.kind === 'mobile' || p.kind === 'landline').length

  async function copy(value: string, tag: string) {
    if (!value) return
    try { await navigator.clipboard.writeText(value); setCopied(tag); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="saudi-phone">
      <Seg>
        <SegButton active={mode === 'one'} data-testid="ph-mode-one" onClick={() => setMode('one')}>{s.one}</SegButton>
        <SegButton active={mode === 'many'} data-testid="ph-mode-many" onClick={() => setMode('many')}>{s.many}</SegButton>
      </Seg>

      {mode === 'one' ? (
        <>
          <Input dir="ltr" className="text-[1.15rem] font-mono" data-testid="ph-input" inputMode="tel"
            placeholder={s.placeholder} value={single} onChange={(e) => setSingle(e.target.value)} />
          {!one && <p className="text-ink-faint text-[0.95rem]">{s.hint}</p>}
          {one && <SingleResult p={one} s={s} copied={copied} copy={copy} />}
        </>
      ) : (
        <>
          <Textarea className="min-h-[8rem] font-mono" dir="ltr" data-testid="ph-list"
            placeholder={s.listPlaceholder} value={list} onChange={(e) => setList(e.target.value)} />
          {many.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[0.9rem] font-semibold text-ink flex-1" data-testid="ph-summary">{s.summary(okCount, many.length)}</span>
                <Button className="flex-none px-3" data-testid="ph-copy-valid"
                  onClick={() => copy(many.filter((p) => p.e164).map((p) => p.e164).join('\n'), 'list')}>
                  <CopyIcon /> {copied === 'list' ? s.copied : s.copyValid}
                </Button>
              </div>
              <div className="flex flex-col divide-y divide-[color:var(--line)] border border-[color:var(--line)] rounded-md overflow-hidden" data-testid="ph-rows">
                {many.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 bg-[var(--surface)] flex-wrap">
                    <span className="font-mono text-[0.85rem] text-ink-faint min-w-[8rem]" dir="ltr">{p.raw}</span>
                    {p.e164
                      ? <span className="font-mono text-[0.95rem] text-ink flex-1" dir="ltr">{p.e164}</span>
                      : <span className="text-[0.85rem] text-gold-500 flex-1 rtl:font-ar">{p.reason || s.invalid}</span>}
                    {p.kind !== 'invalid' && (
                      <span className="font-mono text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint">
                        {p.kind === 'mobile' ? s.mobile : p.kind === 'landline' ? s.landline : s.short}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Stack>
  )
}

function SingleResult({ p, s, copied, copy }: {
  p: Parsed; s: typeof STR['en']; copied: string; copy: (v: string, tag: string) => void
}) {
  const ok = p.kind === 'mobile' || p.kind === 'landline'
  if (!ok) {
    return (
      <Panel data-testid="ph-result">
        <p className="text-[0.95rem] font-semibold text-gold-500 rtl:font-ar" data-testid="ph-invalid">
          {p.kind === 'shortcode' ? s.short : s.invalid}
        </p>
        {p.reason && <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{p.reason}</p>}
      </Panel>
    )
  }
  const rows: [string, string, string][] = [
    [s.e164, p.e164, 'e164'],
    [s.national, p.national, 'nat'],
    [s.intl, p.international, 'intl'],
  ]
  return (
    <Panel className="flex flex-col gap-3" data-testid="ph-result">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[0.95rem] font-semibold text-green-700" data-testid="ph-valid">{s.valid}</span>
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint border border-[color:var(--line)] rounded-sm px-[0.4rem] py-[0.1rem]" data-testid="ph-kind">
          {p.kind === 'mobile' ? s.mobile : s.landline}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map(([label, value, tag]) => (
          <div key={tag} className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint min-w-[9rem]">{label}</span>
            <span className="font-mono text-[1rem] text-ink flex-1" dir="ltr" data-testid={`ph-${tag}`}>{value}</span>
            <Button className="flex-none px-2 py-1" onClick={() => copy(value, tag)} aria-label={s.copy}>
              <CopyIcon /> {copied === tag ? s.copied : s.copy}
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 text-[0.9rem] text-ink-soft">
        {p.region && <p className="rtl:font-ar"><span className="text-ink-faint">{s.region}: </span>{p.region}</p>}
        {p.operator && (
          <>
            <p className="rtl:font-ar" data-testid="ph-operator"><span className="text-ink-faint">{s.operator}: </span>{p.operator}</p>
            <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.portNote}</p>
          </>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => { window.location.href = p.dialable }} data-testid="ph-call"><PhoneIcon /> {s.call}</Button>
        {p.whatsapp && (
          <a href={p.whatsapp} target="_blank" rel="noopener noreferrer" data-testid="ph-whatsapp"
            className="inline-flex items-center gap-[0.45rem] font-body font-semibold text-[0.9rem] px-[0.9rem] py-[0.45rem] rounded-sm border border-[color:var(--line)] bg-[var(--surface)] text-ink-soft hover:text-ink">
            {s.whatsapp}
          </a>
        )}
      </div>
    </Panel>
  )
}
