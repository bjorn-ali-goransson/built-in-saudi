import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Textarea, Stack, Seg, SegButton, Panel } from '../../components/ui'
import { CopyIcon } from '../../components/icons'
import { parseCurl, emit, TARGETS, type Target } from './parse'

const SAMPLE = `curl 'https://api.example.com/v1/orders' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer sk_test_123' \\
  -d '{"item":"widget","qty":2,"express":true}'`

const STR = {
  en: {
    paste: 'Paste a curl command…',
    hint: 'Right-click a request in your browser’s network tab, choose “Copy as cURL”, and paste it here. Quoting, line continuations and multi-header commands are handled.',
    sample: 'Paste a sample',
    invalid: 'That does not look like a curl command with a URL in it.',
    copy: 'Copy', copied: 'Copied!',
    parsed: 'What it parsed',
    method: 'Method', url: 'URL', headers: 'Headers', body: 'Body',
    insecureWarn: 'This command passes -k, which turns off certificate checking. None of the outputs reproduce that by default — if you genuinely need it, you are disabling the thing that makes HTTPS worth using.',
    local: 'The command is parsed in your browser. No request is sent, and nothing — including whatever token is in that Authorization header — leaves this page.',
  },
  ar: {
    paste: 'الصق أمر curl…',
    hint: 'انقر بزر الفأرة الأيمن على طلب في تبويب الشبكة بمتصفحك، واختر «Copy as cURL»، والصقه هنا. تتعامل الأداة مع علامات الاقتباس وأسطر المتابعة والأوامر متعددة الترويسات.',
    sample: 'الصق مثالًا',
    invalid: 'لا يبدو هذا أمر curl يحتوي على رابط.',
    copy: 'نسخ', copied: 'تم النسخ!',
    parsed: 'ما قرأته الأداة',
    method: 'الطريقة', url: 'الرابط', headers: 'الترويسات', body: 'الجسم',
    insecureWarn: 'يمرّر هذا الأمر ‎-k‎ التي تُعطّل التحقق من الشهادة. ولا يعيد أي ناتج هذا السلوك افتراضيًا — وإن كنت تحتاجه فعلًا فأنت تعطّل ما يجعل HTTPS ذا قيمة.',
    local: 'يُحلَّل الأمر داخل متصفحك. لا يُرسل أي طلب، ولا يغادر هذه الصفحة شيء — بما في ذلك أي رمز في ترويسة Authorization.',
  },
}

export default function CurlConvertTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [input, setInput] = useState('')
  const [target, setTarget] = useState<Target>('fetch')
  const [copied, setCopied] = useState(false)

  const req = useMemo(() => (input.trim() ? parseCurl(input) : null), [input])
  const output = useMemo(() => (req ? emit(req, target) : ''), [req, target])

  async function copy() {
    if (!output) return
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="curl-convert">
      <Textarea className="min-h-[8rem] font-mono text-[0.85rem]" dir="ltr" data-testid="cv-input"
        placeholder={s.paste} value={input} onChange={(e) => setInput(e.target.value)} />

      {!input.trim() && (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>
          <Button onClick={() => setInput(SAMPLE)} data-testid="cv-sample">{s.sample}</Button>
        </div>
      )}

      {input.trim() && !req && (
        <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="cv-invalid">{s.invalid}</p>
      )}

      {req && (
        <>
          <Panel className="flex flex-col gap-1 text-[0.88rem]" data-testid="cv-parsed">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.parsed}</span>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span><span className="text-ink-faint">{s.method}: </span><b className="font-mono">{req.method}</b></span>
              <span className="min-w-0 break-all"><span className="text-ink-faint">{s.url}: </span><b className="font-mono" data-testid="cv-url">{req.url}</b></span>
              <span><span className="text-ink-faint">{s.headers}: </span><b data-testid="cv-headers">{req.headers.length}</b></span>
              {req.body && <span><span className="text-ink-faint">{s.body}: </span><b>{req.body.length} B</b></span>}
            </div>
          </Panel>

          {req.insecure && <p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="cv-insecure">{s.insecureWarn}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            <Seg className="flex-wrap">
              {TARGETS.map((t) => (
                <SegButton key={t.id} active={target === t.id} data-testid={`cv-${t.id}`} onClick={() => setTarget(t.id)}>
                  {t.label}
                </SegButton>
              ))}
            </Seg>
            <Button className="px-3 py-1 ms-auto" onClick={copy} data-testid="cv-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>

          <Textarea readOnly dir="ltr" className="min-h-[14rem] font-mono text-[0.85rem]"
            data-testid="cv-output" value={output} onFocus={(e) => e.currentTarget.select()} />

          <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.local}</p>
        </>
      )}
    </Stack>
  )
}
