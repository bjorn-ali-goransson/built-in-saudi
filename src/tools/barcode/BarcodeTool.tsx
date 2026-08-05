import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Stack, Check, Panel } from '../../components/ui'
import { DownloadIcon, CopyIcon, ScanQrIcon } from '../../components/icons'
import { encode, draw, eanCheckDigit, SPECS, type Symbology } from './encode'

const ORDER: Symbology[] = ['ean13', 'ean8', 'upca', 'code128']

const STR = {
  en: {
    type: 'Type', value: 'Value',
    checkDigit: 'Check digit', appended: 'appended automatically',
    size: 'Bar width', height: 'Height', showText: 'Print the number underneath',
    download: 'Download PNG', copy: 'Copy image', copied: 'Copied!',
    needDigits: (n: number) => `Enter ${n} digits — the last one is calculated for you.`,
    tooMany: (n: number) => `Only the first ${n} digits are used.`,
    badChar: 'Code 128 here covers ordinary keyboard characters only — remove anything outside them.',
    empty: 'Type a value to generate a barcode.',
    quiet: 'The white margin on each side is part of the barcode. Do not crop it — without it a scanner cannot find where the code starts, which is the most common reason a printed barcode fails.',
    reader: 'Read a barcode instead',
  },
  ar: {
    type: 'النوع', value: 'القيمة',
    checkDigit: 'رقم التحقق', appended: 'يُضاف تلقائيًا',
    size: 'عرض الشريط', height: 'الارتفاع', showText: 'اطبع الرقم أسفل الباركود',
    download: 'نزّل PNG', copy: 'انسخ الصورة', copied: 'تم النسخ!',
    needDigits: (n: number) => `أدخل ${n.toLocaleString('ar')} رقمًا — ويُحسب الأخير نيابةً عنك.`,
    tooMany: (n: number) => `تُستخدم أول ${n.toLocaleString('ar')} أرقام فقط.`,
    badChar: 'يغطي Code 128 هنا محارف لوحة المفاتيح العادية فقط — أزل ما عداها.',
    empty: 'اكتب قيمة لتوليد باركود.',
    quiet: 'الهامش الأبيض على الجانبين جزء من الباركود. لا تقصّه — فبدونه لا يستطيع الماسح تحديد بداية الرمز، وهذا أكثر أسباب فشل الباركود المطبوع.',
    reader: 'اقرأ باركود بدلًا من ذلك',
  },
}

export default function BarcodeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [symbology, setSymbology] = useState<Symbology>('ean13')
  const [value, setValue] = useState('629104150021')
  const [moduleWidth, setModuleWidth] = useState(2)
  const [height, setHeight] = useState(80)
  const [showText, setShowText] = useState(true)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const spec = SPECS[symbology]

  const result = useMemo(() => {
    const raw = spec.numeric ? value.replace(/\D/g, '') : value
    if (!raw) return { error: s.empty as string, enc: null }
    if (spec.digits && raw.length < spec.digits) return { error: s.needDigits(spec.digits), enc: null }
    try {
      return { error: '', enc: encode(symbology, raw) }
    } catch {
      return { error: s.badChar, enc: null }
    }
  }, [symbology, value, spec, s])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !result.enc) return
    draw(canvas, result.enc, { moduleWidth, height, showText, quietZone: 10 })
  }, [result.enc, moduleWidth, height, showText])

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `barcode-${result.enc?.text ?? 'code'}.png`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  async function copy() {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) return
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard image writes are not universally allowed */ }
  }

  const digitsEntered = value.replace(/\D/g, '')

  return (
    <Stack data-testid="barcode">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.type}
          <Select className="min-w-[13rem]" data-testid="bc-type" value={symbology}
            onChange={(e) => setSymbology(e.target.value as Symbology)}>
            {ORDER.map((k) => <option key={k} value={k}>{k.toUpperCase()}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint flex-1 min-w-[14rem]">
          {s.value}
          <Input dir="ltr" className="font-mono" data-testid="bc-value"
            inputMode={spec.numeric ? 'numeric' : 'text'}
            value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
      </div>

      <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="bc-spec">{spec[locale]}</p>

      {spec.digits && digitsEntered.length >= spec.digits && (
        <p className="text-[0.85rem] text-green-700" data-testid="bc-check">
          {s.checkDigit}: <b className="font-mono">{eanCheckDigit(digitsEntered.slice(0, spec.digits))}</b> — {s.appended}
        </p>
      )}
      {spec.digits && digitsEntered.length > spec.digits && (
        <p className="text-[0.85rem] text-gold-500 rtl:font-ar">{s.tooMany(spec.digits)}</p>
      )}

      {result.error ? (
        <p className="text-[0.95rem] text-ink-soft rtl:font-ar" data-testid="bc-error">{result.error}</p>
      ) : (
        <>
          <div className="flex justify-center overflow-x-auto p-3 bg-white rounded-md border border-[color:var(--line)]">
            <canvas ref={canvasRef} data-testid="bc-canvas" />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
              {s.size}
              <Input type="range" min={1} max={6} step={1} className="w-28 p-0" data-testid="bc-width"
                value={moduleWidth} onChange={(e) => setModuleWidth(+e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
              {s.height}
              <Input type="range" min={30} max={200} step={10} className="w-28 p-0" data-testid="bc-height"
                value={height} onChange={(e) => setHeight(+e.target.value)} />
            </label>
            <Check>
              <input type="checkbox" checked={showText} data-testid="bc-text" onChange={(e) => setShowText(e.target.checked)} /> {s.showText}
            </Check>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={download} data-testid="bc-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={copy} data-testid="bc-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            <Button to={`/${locale}/apps/qr-reader`}><ScanQrIcon /> {s.reader}</Button>
          </div>

          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.quiet}</p></Panel>
        </>
      )}
    </Stack>
  )
}
