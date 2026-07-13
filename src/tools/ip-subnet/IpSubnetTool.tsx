import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    input: 'IPv4 address / CIDR', network: 'Network address', broadcast: 'Broadcast address', firstHost: 'First host', lastHost: 'Last host',
    mask: 'Subnet mask', wildcard: 'Wildcard', hosts: 'Usable hosts', invalid: 'Enter a valid IPv4/CIDR, e.g. 192.168.1.10/24.',
    privacy: 'Computed in your browser — nothing is uploaded.',
  },
  ar: {
    input: 'عنوان IPv4 / CIDR', network: 'عنوان الشبكة', broadcast: 'عنوان البثّ', firstHost: 'أول مضيف', lastHost: 'آخر مضيف',
    mask: 'قناع الشبكة', wildcard: 'القناع البديل', hosts: 'المضيفون القابلون للاستخدام', invalid: 'أدخل IPv4/CIDR صالحًا، مثل 192.168.1.10/24.',
    privacy: 'يُحسب في متصفحك — لا يُرفع أي شيء.',
  },
}

const toStr = (n: number) => [24, 16, 8, 0].map((sh) => (n >>> sh) & 255).join('.')

function parse(input: string) {
  const m = input.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/)
  if (!m) return null
  const oct = [m[1], m[2], m[3], m[4]].map(Number)
  const prefix = Number(m[5])
  if (oct.some((o) => o > 255) || prefix > 32) return null
  const ip = ((oct[0] << 24) | (oct[1] << 16) | (oct[2] << 8) | oct[3]) >>> 0
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const network = (ip & mask) >>> 0
  const broadcast = (network | (~mask >>> 0)) >>> 0
  const total = Math.pow(2, 32 - prefix)
  const usable = prefix >= 31 ? (prefix === 32 ? 1 : 2) : total - 2
  const first = prefix >= 31 ? network : (network + 1) >>> 0
  const last = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0
  return { network, broadcast, first, last, mask, wildcard: (~mask >>> 0), usable, prefix }
}

export default function IpSubnetTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [input, setInput] = useState('192.168.1.10/24')
  const r = useMemo(() => parse(input), [input])

  const Row = ({ label, value, testid }: { label: string; value: string; testid?: string }) => (
    <div className="flex justify-between gap-3 py-1.5 border-b border-[color:var(--line-soft)] text-[0.9rem]">
      <span className="text-ink-soft">{label}</span><span className="font-mono text-ink text-end" data-testid={testid}>{value}</span>
    </div>
  )

  return (
    <Stack data-testid="ip-subnet">
      <label className="flex flex-col gap-[0.4rem] max-w-sm"><FieldLabel>{s.input}</FieldLabel>
        <Input value={input} onChange={(e) => setInput(e.target.value)} dir="ltr" className="font-mono text-[1.05rem]" data-testid="ipc-input" /></label>

      {r ? (
        <div className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] px-3 py-1">
          <Row label={s.network} value={`${toStr(r.network)}/${r.prefix}`} testid="ipc-network" />
          <Row label={s.broadcast} value={toStr(r.broadcast)} testid="ipc-broadcast" />
          <Row label={s.firstHost} value={toStr(r.first)} testid="ipc-first" />
          <Row label={s.lastHost} value={toStr(r.last)} testid="ipc-last" />
          <Row label={s.mask} value={toStr(r.mask)} testid="ipc-mask" />
          <Row label={s.wildcard} value={toStr(r.wildcard)} />
          <Row label={s.hosts} value={r.usable.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')} testid="ipc-hosts" />
        </div>
      ) : <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="ipc-error">{s.invalid}</p>}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
