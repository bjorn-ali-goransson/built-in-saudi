import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Input, Textarea, Check, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    pattern: 'Pattern', flags: 'Flags', test: 'Test text', matches: 'matches', noMatch: 'No matches',
    groups: 'Capture groups', privacy: 'Runs locally in your browser — nothing is uploaded.',
    g: 'global', i: 'ignore case', m: 'multiline', s: 'dotall', u: 'unicode', placeholder: 'Type text to test against…',
  },
  ar: {
    pattern: 'النمط', flags: 'الأعلام', test: 'نص الاختبار', matches: 'مطابقة', noMatch: 'لا مطابقات',
    groups: 'مجموعات الالتقاط', privacy: 'يعمل محليًا في متصفحك — لا يُرفع أي شيء.',
    g: 'شامل', i: 'تجاهل الحالة', m: 'أسطر متعددة', s: 'نقطة تشمل الأسطر', u: 'يونيكود', placeholder: 'اكتب نصًا للاختبار…',
  },
}

const FLAGS = ['g', 'i', 'm', 's', 'u'] as const

export default function RegexTesterTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [pattern, setPattern] = useState('\\b\\w+@\\w+\\.\\w+\\b')
  const [flags, setFlags] = useState('g')
  const [text, setText] = useState('Reach us at hi@built-in-saudi.com or sales@example.org.')

  const { error, parts, count, groups } = useMemo(() => {
    if (!pattern) return { error: '', parts: [{ t: text, m: false }], count: 0, groups: [] as string[][] }
    let re: RegExp
    try { re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g') }
    catch (e) { return { error: (e as Error).message, parts: [{ t: text, m: false }], count: 0, groups: [] as string[][] } }
    const out: { t: string; m: boolean }[] = []
    const grps: string[][] = []
    let last = 0, n = 0
    for (const match of text.matchAll(re)) {
      const i = match.index ?? 0
      if (i > last) out.push({ t: text.slice(last, i), m: false })
      out.push({ t: match[0] || '', m: true })
      last = i + (match[0]?.length || 0)
      if (match.length > 1) grps.push(match.slice(1).map((g) => g ?? ''))
      n++
      if (!match[0]) { last++ } // avoid zero-length loop
    }
    if (last < text.length) out.push({ t: text.slice(last), m: false })
    return { error: '', parts: out, count: n, groups: grps }
  }, [pattern, flags, text])

  const toggle = (f: string) => setFlags((cur) => (cur.includes(f) ? cur.replace(f, '') : cur + f))

  return (
    <Stack data-testid="regex-tester">
      <Panel>
        <div className="grid gap-[0.8rem]">
          <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.pattern}</FieldLabel>
            <div className="flex items-center gap-2">
              <span className="font-mono text-ink-faint">/</span>
              <Input value={pattern} onChange={(e) => setPattern(e.target.value)} className="font-mono flex-1" dir="ltr" data-testid="re-pattern" />
              <span className="font-mono text-ink-faint">/{flags}</span>
            </div>
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-2" data-testid="re-flags">
            {FLAGS.map((f) => (
              <Check key={f}><input type="checkbox" checked={flags.includes(f)} onChange={() => toggle(f)} data-testid={`re-flag-${f}`} /> <span className="font-mono">{f}</span> · {s[f]}</Check>
            ))}
          </div>
        </div>
      </Panel>

      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.test}</FieldLabel>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="font-mono text-[0.9rem]" placeholder={s.placeholder} data-testid="re-input" /></label>

      {error
        ? <p className="text-[color:var(--danger)] text-[0.9rem] font-mono" data-testid="re-error">{error}</p>
        : <p className="text-[0.85rem] text-ink-soft" data-testid="re-count">{count > 0 ? `${count} ${s.matches}` : s.noMatch}</p>}

      {!error && (
        <div className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3 font-mono text-[0.9rem] whitespace-pre-wrap break-words" dir="ltr" data-testid="re-output">
          {parts.map((p, i) => p.m
            ? <mark key={i} className="bg-[color-mix(in_srgb,var(--color-gold-400)_45%,transparent)] text-ink rounded-[2px] px-[1px]">{p.t}</mark>
            : <span key={i}>{p.t}</span>)}
        </div>
      )}

      {groups.length > 0 && (
        <div className="text-[0.85rem] text-ink-soft">
          <FieldLabel>{s.groups}</FieldLabel>
          <ol className="mt-1 flex flex-col gap-1 font-mono">
            {groups.slice(0, 20).map((g, i) => <li key={i} className="text-ink">{i + 1}. [{g.map((x) => JSON.stringify(x)).join(', ')}]</li>)}
          </ol>
        </div>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
