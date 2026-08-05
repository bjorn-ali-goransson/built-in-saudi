import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Stack, Spinner, Panel } from '../../components/ui'
import { UploadIcon, SearchIcon, BinaryIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { sniff } from './signatures'

const ROW = 16
const PAGE = 32 * 1024 // bytes rendered at once — a 2GB file must not become 2GB of DOM

const STR = {
  en: {
    pick: 'Choose a file', another: 'Choose another', reading: 'Reading…',
    hint: 'Look at the actual bytes of any file — the header that says what it really is, the strings hiding inside it, the padding at the end. Nothing is uploaded.',
    size: 'Size', detected: 'Looks like', unknown: 'not a format this recognises',
    offset: 'Go to offset', find: 'Find bytes or text',
    notFound: 'Not found.', foundAt: (n: number) => `Found at offset 0x${n.toString(16).toUpperCase()}`,
    showing: (from: number, to: number, total: number) => `Bytes ${from.toLocaleString('en')}–${to.toLocaleString('en')} of ${total.toLocaleString('en')}`,
    prev: 'Previous', next: 'Next',
    mismatch: 'The extension and the contents disagree. That is not necessarily sinister — people rename files — but it does mean the extension is not telling you what this is.',
  },
  ar: {
    pick: 'اختر ملفًا', another: 'اختر ملفًا آخر', reading: 'جارٍ القراءة…',
    hint: 'اطّلع على بايتات أي ملف — الترويسة التي تكشف حقيقته، والنصوص المخبوءة فيه، والحشو في نهايته. لا يُرفع شيء.',
    size: 'الحجم', detected: 'يبدو أنه', unknown: 'صيغة غير معروفة للأداة',
    offset: 'اذهب إلى الإزاحة', find: 'ابحث عن بايتات أو نص',
    notFound: 'غير موجود.', foundAt: (n: number) => `وُجد عند الإزاحة 0x${n.toString(16).toUpperCase()}`,
    showing: (from: number, to: number, total: number) => `البايتات ${from.toLocaleString('ar')}–${to.toLocaleString('ar')} من ${total.toLocaleString('ar')}`,
    prev: 'السابق', next: 'التالي',
    mismatch: 'الامتداد ومحتوى الملف لا يتفقان. وهذا ليس مريبًا بالضرورة — فالناس يعيدون تسمية الملفات — لكنه يعني أن الامتداد لا يخبرك بحقيقة الملف.',
  },
}

export default function HexViewerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [start, setStart] = useState(0)
  const [query, setQuery] = useState('')
  const [searchMsg, setSearchMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => setWorkInProgress('hex-viewer', false), [])

  async function pick(f: File | undefined) {
    if (!f) return
    setBusy(true)
    try {
      setBytes(new Uint8Array(await f.arrayBuffer()))
      setName(f.name)
      setStart(0)
      setSearchMsg('')
      setWorkInProgress('hex-viewer', true)
    } finally { setBusy(false) }
  }

  const detected = useMemo(() => (bytes ? sniff(bytes) : null), [bytes])
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const mismatch = !!detected && !!ext && !detected.extensions.includes(ext)

  const rows = useMemo(() => {
    if (!bytes) return []
    const end = Math.min(bytes.length, start + PAGE)
    const out: { offset: number; hex: string[]; ascii: string }[] = []
    for (let i = start; i < end; i += ROW) {
      const slice = bytes.subarray(i, Math.min(i + ROW, end))
      out.push({
        offset: i,
        hex: [...slice].map((b) => b.toString(16).padStart(2, '0')),
        // Printable ASCII only; everything else is a dot, which is what makes
        // embedded strings jump out of a wall of hex.
        ascii: [...slice].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join(''),
      })
    }
    return out
  }, [bytes, start])

  function search() {
    if (!bytes || !query.trim()) return
    // "de ad be ef" or "0xDEADBEEF" is read as bytes; anything else as text.
    const hexish = /^(0x)?[0-9a-f\s]+$/i.test(query) && query.replace(/[^0-9a-f]/gi, '').length % 2 === 0
    let needle: Uint8Array
    if (hexish) {
      const clean = query.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '')
      needle = new Uint8Array(clean.length / 2)
      for (let i = 0; i < needle.length; i++) needle[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
    } else {
      needle = new TextEncoder().encode(query)
    }
    if (!needle.length) return
    // Search from just after the current view so repeated presses walk forward.
    const from = start + 1
    const found = indexOfBytes(bytes, needle, from) ?? indexOfBytes(bytes, needle, 0)
    if (found === null) { setSearchMsg(s.notFound); return }
    setStart(Math.max(0, found - (found % ROW)))
    setSearchMsg(s.foundAt(found))
  }

  const end = bytes ? Math.min(bytes.length, start + PAGE) : 0

  return (
    <Stack data-testid="hex-viewer">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" className="hidden" data-testid="hx-file" onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="hx-pick">
          <UploadIcon /> {bytes ? s.another : s.pick}
        </Button>
        {busy && <Spinner className="size-5" />}
      </div>

      {!bytes && !busy && <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>}

      {bytes && (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.9rem]">
            <span className="font-semibold text-ink break-all">{name}</span>
            <span className="text-ink-faint"><span className="rtl:font-ar">{s.size}</span>: <span className="font-mono">{bytes.length.toLocaleString(locale === 'ar' ? 'ar' : 'en')} B</span></span>
            <span className="text-ink-faint" data-testid="hx-detected">
              <span className="rtl:font-ar">{s.detected}</span>: <b className="text-ink">{detected ? detected.label : s.unknown}</b>
            </span>
          </div>

          {mismatch && <Panel><p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="hx-mismatch">{s.mismatch}</p></Panel>}

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.find}
              <div className="flex gap-1">
                <Input dir="ltr" className="w-52 font-mono" data-testid="hx-query"
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') search() }} />
                <Button className="px-3" onClick={search} data-testid="hx-search"><SearchIcon /></Button>
              </div>
            </label>
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.offset}
              <Input dir="ltr" className="w-32 font-mono" data-testid="hx-offset" placeholder="0x0"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  const raw = (e.target as HTMLInputElement).value.trim()
                  const n = raw.startsWith('0x') ? parseInt(raw.slice(2), 16) : parseInt(raw, 10)
                  if (Number.isFinite(n)) setStart(Math.max(0, Math.min(bytes.length - 1, n - (n % ROW))))
                }} />
            </label>
          </div>
          {searchMsg && <p className="text-[0.85rem] text-green-700 rtl:font-ar" data-testid="hx-searchmsg">{searchMsg}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            <BinaryIcon className="text-ink-faint" />
            <span className="text-[0.85rem] text-ink-faint font-mono flex-1" data-testid="hx-range">{s.showing(start, end, bytes.length)}</span>
            <Button className="px-3 py-1" disabled={start === 0} data-testid="hx-prev"
              onClick={() => setStart(Math.max(0, start - PAGE))}>{s.prev}</Button>
            <Button className="px-3 py-1" disabled={end >= bytes.length} data-testid="hx-next"
              onClick={() => setStart(Math.min(bytes.length - 1, start + PAGE))}>{s.next}</Button>
          </div>

          <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]" data-testid="hx-dump">
            <pre className="font-mono text-[0.78rem] leading-[1.5] p-3 m-0" dir="ltr">
              {rows.map((r) => (
                <div key={r.offset} className="whitespace-pre">
                  <span className="text-ink-faint">{r.offset.toString(16).padStart(8, '0')}</span>
                  {'  '}
                  <span className="text-ink">{r.hex.map((h, i) => (i === 8 ? ' ' + h : h)).join(' ').padEnd(ROW * 3, ' ')}</span>
                  {'  '}
                  <span className="text-green-700">{r.ascii}</span>
                </div>
              ))}
            </pre>
          </div>
        </>
      )}
    </Stack>
  )
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number | null {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer
    return i
  }
  return null
}
