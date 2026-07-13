import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, FieldLabel } from '../../components/ui'

const STR = {
  en: { input: 'User-agent string', browser: 'Browser', engine: 'Engine', os: 'Operating system', device: 'Device type', unknown: 'Unknown', desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', bot: 'Bot / crawler', privacy: 'Parsed locally — your user-agent is never uploaded.' },
  ar: { input: 'نص وكيل المستخدم', browser: 'المتصفح', engine: 'المحرّك', os: 'نظام التشغيل', device: 'نوع الجهاز', unknown: 'غير معروف', desktop: 'سطح مكتب', mobile: 'جوّال', tablet: 'لوحي', bot: 'روبوت / زاحف', privacy: 'يُحلَّل محليًا — لا يُرفع وكيلك أبدًا.' },
}

function detect(ua: string, s: typeof STR['en']) {
  const browsers: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, 'Edge'], [/OPR\/([\d.]+)/, 'Opera'], [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
    [/Firefox\/([\d.]+)/, 'Firefox'], [/CriOS\/([\d.]+)/, 'Chrome (iOS)'], [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ]
  const engines: [RegExp, string][] = [[/Gecko\/\d/, 'Gecko'], [/AppleWebKit\/([\d.]+)/, 'WebKit/Blink'], [/Trident/, 'Trident']]
  const oses: [RegExp, string][] = [
    [/Windows NT 10/, 'Windows 10/11'], [/Windows NT ([\d.]+)/, 'Windows'], [/Android ([\d.]+)/, 'Android'],
    [/iPhone OS ([\d_]+)/, 'iOS'], [/iPad.*OS ([\d_]+)/, 'iPadOS'], [/Mac OS X ([\d_]+)/, 'macOS'],
    [/CrOS/, 'ChromeOS'], [/Linux/, 'Linux'],
  ]
  const pick = (list: [RegExp, string][]) => { for (const [re, name] of list) { const m = ua.match(re); if (m) return m[1] ? `${name} ${m[1].replace(/_/g, '.')}` : name } return s.unknown }
  const device = /bot|crawler|spider|crawling/i.test(ua) ? s.bot : /Tablet|iPad/.test(ua) ? s.tablet : /Mobi|Android.*Mobile|iPhone/.test(ua) ? s.mobile : s.desktop
  return { browser: pick(browsers), engine: pick(engines), os: pick(oses), device }
}

export default function UserAgentTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [ua, setUa] = useState(() => (typeof navigator !== 'undefined' ? navigator.userAgent : ''))
  const info = useMemo(() => (ua.trim() ? detect(ua, s) : null), [ua, s])

  return (
    <Stack data-testid="user-agent">
      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input}</FieldLabel>
        <Textarea value={ua} onChange={(e) => setUa(e.target.value)} rows={3} dir="ltr" className="font-mono text-[0.82rem] break-all" data-testid="ua-input" /></label>

      {info && (
        <div className="grid gap-2 sm:grid-cols-2">
          {[[s.browser, info.browser, 'ua-browser'], [s.engine, info.engine, 'ua-engine'], [s.os, info.os, 'ua-os'], [s.device, info.device, 'ua-device']].map(([label, value, testid]) => (
            <div key={testid} className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3">
              <p className="text-[0.75rem] text-ink-faint">{label}</p><p className="text-[1.05rem] font-semibold text-ink" data-testid={testid}>{value}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
