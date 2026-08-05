import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Stack, Panel, Check } from '../../components/ui'
import { CopyIcon, TrashIcon, KeyIcon } from '../../components/icons'
import {
  totp, secondsLeft, parseOtpauth, isValidSecret, loadAccounts, saveAccounts, newId,
  type Account, type Algo,
} from './totp'

const STR = {
  en: {
    secret: 'Secret or otpauth:// link',
    secretPh: 'JBSWY3DPEHPK3PXP  —  or paste the otpauth:// URI',
    label: 'Name', labelPh: 'e.g. GitHub',
    algo: 'Algorithm', digits: 'Digits', period: 'Period',
    add: 'Add', invalid: 'That is not a valid base32 secret or otpauth link.',
    remember: 'Remember this on this device',
    rememberHint: 'Off by default. A stored secret can generate codes for anyone with this browser — leave it off on a shared machine.',
    copy: 'Copy', copied: 'Copied!', remove: 'Remove',
    empty: 'Add a secret to start generating codes.',
    expiresIn: (n: number) => `${n}s`,
    warning: 'This is a code generator, not a password manager. Your secret never leaves this page — but that also means nothing here is backed up. Keep the recovery codes your service gave you.',
    sessionOnly: 'Not saved — this code disappears when you leave the page.',
  },
  ar: {
    secret: 'المفتاح السري أو رابط ‎otpauth://‎',
    secretPh: 'JBSWY3DPEHPK3PXP  —  أو الصق رابط ‎otpauth://‎',
    label: 'الاسم', labelPh: 'مثال: GitHub',
    algo: 'الخوارزمية', digits: 'الخانات', period: 'المدة',
    add: 'أضف', invalid: 'ليس مفتاح base32 صالحًا ولا رابط otpauth.',
    remember: 'تذكّره على هذا الجهاز',
    rememberHint: 'مُطفأ افتراضيًا. المفتاح المحفوظ يولّد رموزًا لكل من يصل إلى هذا المتصفح — أبقِه مُطفأً على جهاز مشترك.',
    copy: 'نسخ', copied: 'تم النسخ!', remove: 'حذف',
    empty: 'أضف مفتاحًا لتبدأ توليد الرموز.',
    expiresIn: (n: number) => `${n} ث`,
    warning: 'هذه أداة توليد رموز، وليست مدير كلمات مرور. لا يغادر مفتاحك هذه الصفحة — وهذا يعني أيضًا أنه غير محفوظ في أي نسخة احتياطية. احتفظ برموز الاسترداد التي أعطتك إياها الخدمة.',
    sessionOnly: 'غير محفوظ — يختفي هذا الرمز عند مغادرة الصفحة.',
  },
}

const ALGOS: Algo[] = ['SHA-1', 'SHA-256', 'SHA-512']

export default function TotpTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [accounts, setAccounts] = useState<Account[]>([])
  const [remember, setRemember] = useState(false)
  const [secret, setSecret] = useState('')
  const [label, setLabel] = useState('')
  const [algo, setAlgo] = useState<Algo>('SHA-1')
  const [digits, setDigits] = useState(6)
  const [period, setPeriod] = useState(30)
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = loadAccounts()
    if (stored.length) { setAccounts(stored); setRemember(true) }
  }, [])
  // Only persist while the user has opted in; turning it off wipes the store.
  useEffect(() => {
    if (remember) saveAccounts(accounts)
    else saveAccounts([])
  }, [accounts, remember])

  function add() {
    const trimmed = secret.trim()
    if (!trimmed) return
    if (trimmed.toLowerCase().startsWith('otpauth:')) {
      const parsed = parseOtpauth(trimmed)
      if (!parsed) { setError(s.invalid); return }
      setAccounts((a) => [...a, { id: newId(), ...parsed }])
    } else {
      if (!isValidSecret(trimmed)) { setError(s.invalid); return }
      setAccounts((a) => [...a, {
        id: newId(), label: label.trim() || 'Account', issuer: '', secret: trimmed, algo, digits, period,
      }])
    }
    setSecret(''); setLabel(''); setError('')
  }

  return (
    <Stack data-testid="totp">
      <Panel className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.secret}
          <Input dir="ltr" className="font-mono" data-testid="totp-secret" placeholder={s.secretPh}
            value={secret} onChange={(e) => { setSecret(e.target.value); setError('') }} />
        </label>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.label}
            <Input className="w-40" data-testid="totp-label" placeholder={s.labelPh} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.algo}
            <Select className="w-32" data-testid="totp-algo" value={algo} onChange={(e) => setAlgo(e.target.value as Algo)}>
              {ALGOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.digits}
            <Select className="w-20" data-testid="totp-digits" value={digits} onChange={(e) => setDigits(+e.target.value)}>
              <option value={6}>6</option><option value={8}>8</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.period}
            <Input type="number" min={10} max={300} className="w-20" data-testid="totp-period"
              value={period} onChange={(e) => setPeriod(+e.target.value || 30)} />
          </label>
          <Button variant="primary" onClick={add} data-testid="totp-add"><KeyIcon /> {s.add}</Button>
        </div>
        {error && <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="totp-error">{error}</p>}
        <Check>
          <input type="checkbox" checked={remember} data-testid="totp-remember" onChange={(e) => setRemember(e.target.checked)} />
          {s.remember}
        </Check>
        <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.rememberHint}</p>
      </Panel>

      {accounts.length === 0 ? (
        <p className="text-ink-faint text-[0.95rem] rtl:font-ar" data-testid="totp-empty">{s.empty}</p>
      ) : (
        <div className="flex flex-col gap-2" data-testid="totp-list">
          {accounts.map((a) => (
            <CodeRow key={a.id} account={a} s={s}
              onRemove={() => setAccounts((all) => all.filter((x) => x.id !== a.id))} />
          ))}
        </div>
      )}

      {!remember && accounts.length > 0 && <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.sessionOnly}</p>}
      <p className="text-[0.85rem] text-gold-500 rtl:font-ar">{s.warning}</p>
    </Stack>
  )
}

function CodeRow({ account, s, onRemove }: { account: Account; s: typeof STR['en']; onRemove: () => void }) {
  const [code, setCode] = useState('------')
  const [left, setLeft] = useState(account.period)
  const [copied, setCopied] = useState(false)
  const lastCounter = useRef(-1)

  useEffect(() => {
    let alive = true
    async function tick() {
      const now = Date.now()
      const counter = Math.floor(now / 1000 / account.period)
      setLeft(secondsLeft(account.period, now))
      // Only re-derive when the window actually rolls — a HMAC every 250ms for
      // every account is pointless work.
      if (counter !== lastCounter.current) {
        lastCounter.current = counter
        const c = await totp(account, now)
        if (alive && c) setCode(c)
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => { alive = false; clearInterval(id) }
  }, [account])

  const pct = (left / account.period) * 100
  const urgent = left <= 5

  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-[color:var(--line)] rounded-md bg-[var(--surface)] px-3 py-2.5" data-testid="totp-row">
      <div className="flex flex-col flex-1 min-w-[8rem]">
        <span className="text-[0.9rem] font-semibold text-ink">{account.issuer ? `${account.issuer} · ` : ''}{account.label}</span>
        <span className="font-mono text-[0.72rem] text-ink-faint">{account.algo} · {account.digits} · {account.period}s</span>
      </div>
      <span className={`font-mono text-[1.7rem] tracking-[0.16em] tabular-nums ${urgent ? 'text-gold-500' : 'text-ink'}`} data-testid="totp-code">
        {code}
      </span>
      <div className="flex items-center gap-2">
        <div className="w-10 h-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-ink)_12%,transparent)] overflow-hidden" aria-hidden="true">
          <div className={`h-full ${urgent ? 'bg-gold-500' : 'bg-green-600'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-[0.78rem] text-ink-faint w-8" data-testid="totp-left">{s.expiresIn(left)}</span>
        <Button className="px-2 py-1" onClick={copy} aria-label={s.copy} data-testid="totp-copy">
          <CopyIcon /> {copied ? s.copied : ''}
        </Button>
        <Button className="px-2 py-1" onClick={onRemove} aria-label={s.remove} data-testid="totp-remove"><TrashIcon /></Button>
      </div>
    </div>
  )
}
