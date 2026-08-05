import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Stack, Panel } from '../../components/ui'
import { CopyIcon, CompassIcon, KaabaIcon } from '../../components/icons'
import { geolocate } from '../../lib/prayerLocation'
import { parse, toDecimal, toDms, toDdm, toUtm, formatUtm, toMgrs, distance, bearing } from './convert'

const STR = {
  en: {
    input: 'Coordinates', placeholder: '24.7136, 46.6753  ·  24°42\'49"N 46°40\'31"E',
    hint: 'Paste coordinates in any common notation — decimal, degrees-minutes-seconds, or degrees and decimal minutes — and get every other form. Arabic-Indic digits are accepted.',
    myLocation: 'Use my location', invalid: 'Could not read a coordinate pair from that.',
    decimal: 'Decimal', dms: 'Degrees, minutes, seconds', ddm: 'Degrees and decimal minutes',
    utm: 'UTM', mgrs: 'MGRS',
    copy: 'Copy', copied: 'Copied!',
    second: 'A second point', distance: 'Distance', bearing: 'Bearing',
    addSecond: 'Measure to another point',
    poles: 'UTM and MGRS are not defined above 84°N or below 80°S, so those two are blank for polar coordinates.',
    maps: 'Open in Maps', qibla: 'Qibla from here',
  },
  ar: {
    input: 'الإحداثيات', placeholder: '٢٤٫٧١٣٦، ٤٦٫٦٧٥٣  ·  24°42\'49"N 46°40\'31"E',
    hint: 'الصق إحداثيات بأي صيغة شائعة — عشرية أو درجات ودقائق وثوانٍ أو درجات ودقائق عشرية — واحصل على بقية الصيغ. والأرقام الهندية مقبولة.',
    myLocation: 'استخدم موقعي', invalid: 'تعذّرت قراءة زوج إحداثيات من هذا.',
    decimal: 'عشري', dms: 'درجات ودقائق وثوانٍ', ddm: 'درجات ودقائق عشرية',
    utm: 'UTM', mgrs: 'MGRS',
    copy: 'نسخ', copied: 'تم النسخ!',
    second: 'نقطة ثانية', distance: 'المسافة', bearing: 'الاتجاه',
    addSecond: 'قِس إلى نقطة أخرى',
    poles: 'صيغتا UTM وMGRS غير معرّفتين شمال ٨٤° أو جنوب ٨٠°، لذا تبقيان فارغتين عند القطبين.',
    maps: 'افتح في الخرائط', qibla: 'القبلة من هنا',
  },
}

export default function CoordinatesTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('24.7136, 46.6753')
  const [second, setSecond] = useState('')
  const [showSecond, setShowSecond] = useState(false)
  const [copied, setCopied] = useState('')

  const point = useMemo(() => parse(raw), [raw])
  const other = useMemo(() => (second.trim() ? parse(second) : null), [second])

  const rows = useMemo(() => {
    if (!point) return []
    const utm = toUtm(point)
    return [
      { key: 'decimal', label: s.decimal, value: toDecimal(point) },
      { key: 'dms', label: s.dms, value: toDms(point) },
      { key: 'ddm', label: s.ddm, value: toDdm(point) },
      { key: 'utm', label: s.utm, value: utm ? formatUtm(utm) : '—' },
      { key: 'mgrs', label: s.mgrs, value: toMgrs(point) ?? '—' },
    ]
  }, [point, s])

  async function copy(value: string, key: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }
  async function useMine() {
    const g = await geolocate()
    if (g) setRaw(`${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`)
  }

  const polar = point && (point.lat > 84 || point.lat < -80)

  return (
    <Stack data-testid="coordinates">
      <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
        {s.input}
        <Input dir="ltr" className="font-mono text-[1.05rem]" data-testid="co-input"
          placeholder={s.placeholder} value={raw} onChange={(e) => setRaw(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={useMine} data-testid="co-geo"><CompassIcon /> {s.myLocation}</Button>
        {!showSecond && <Button onClick={() => setShowSecond(true)} data-testid="co-add">{s.addSecond}</Button>}
      </div>

      {!point ? (
        <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="co-invalid">{raw.trim() ? s.invalid : s.hint}</p>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-[color:var(--line)] border border-[color:var(--line)] rounded-md overflow-hidden" data-testid="co-rows">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-3 px-3 py-2 bg-[var(--surface)] flex-wrap">
                <span className="text-[0.8rem] text-ink-faint w-52 rtl:font-ar">{r.label}</span>
                <span className="font-mono text-[0.95rem] text-ink flex-1 break-all" data-testid={`co-${r.key}`}>{r.value}</span>
                <Button className="px-2 py-1 flex-none" onClick={() => copy(r.value, r.key)} aria-label={s.copy}>
                  <CopyIcon /> {copied === r.key ? s.copied : ''}
                </Button>
              </div>
            ))}
          </div>

          {polar && <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="co-polar">{s.poles}</p>}

          <div className="flex flex-wrap gap-2">
            <Button href={`https://www.google.com/maps?q=${point.lat},${point.lng}`} target="_blank" rel="noopener noreferrer" data-testid="co-maps">
              {s.maps}
            </Button>
            <Button to={`/${locale}/apps/qibla`}><KaabaIcon /> {s.qibla}</Button>
          </div>

          {showSecond && (
            <Panel className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
                {s.second}
                <Input dir="ltr" className="font-mono" data-testid="co-second"
                  placeholder={s.placeholder} value={second} onChange={(e) => setSecond(e.target.value)} />
              </label>
              {other && (
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  <div className="flex flex-col">
                    <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.distance}</span>
                    <span className="font-display text-[1.3rem] text-ink" data-testid="co-distance">
                      {distance(point, other) >= 1000
                        ? `${(distance(point, other) / 1000).toFixed(2)} km`
                        : `${Math.round(distance(point, other))} m`}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.bearing}</span>
                    <span className="font-display text-[1.3rem] text-ink" data-testid="co-bearing">
                      {bearing(point, other).toFixed(1)}°
                    </span>
                  </div>
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </Stack>
  )
}
