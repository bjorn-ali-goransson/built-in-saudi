import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { DownloadIcon, RefreshIcon, CopyIcon } from '../../components/icons'
import { Button, Input, Textarea, Field, Check, Stack, Panel, Seg, SegButton } from '../../components/ui'
import { newSeed } from '../../lib/printPdf'
import { DEFAULTS, FREE, buildCards, makeCards, type BingoOptions } from './bingo'

const SAMPLE = {
  en: 'Riyadh\nJeddah\nMakkah\nMadinah\nDammam\nAbha\nTabuk\nTaif\nKhobar\nHail\nJazan\nNajran\nYanbu\nBuraidah\nAl-Ula\nQatif\nJubail\nArar\nSakaka\nBaha\nKhamis Mushait\nUnaizah\nHafar Al-Batin\nRas Tanura\nAl-Kharj',
  ar: 'الرياض\nجدة\nمكة\nالمدينة\nالدمام\nأبها\nتبوك\nالطائف\nالخبر\nحائل\nجازان\nنجران\nينبع\nبريدة\nالعُلا\nالقطيف\nالجبيل\nعرعر\nسكاكا\nالباحة\nخميس مشيط\nعنيزة\nحفر الباطن\nرأس تنورة\nالخرج',
}

const STR = {
  en: {
    items: 'Items — one per line', placeholder: 'Word or number on each line',
    sample: 'Load a sample list',
    size: 'Grid', count: 'How many cards',
    free: 'Free centre square', twoUp: 'Two cards per page',
    title: 'Card title', titlePlaceholder: 'Class 4B',
    seed: 'Set code',
    seedWhy: 'The same code makes the same set of cards. Reprint one that got torn and it is still the card that child was playing.',
    regenerate: 'New set',
    download: 'Download PDF', working: 'Building…',
    preview: 'First card',
    pool: (n: number, need: number) => `${n} items · ${need} needed per card`,
    tooFew: (need: number) => `Not enough items — a card needs ${need}. Add more lines.`,
    short: (got: number, want: number) => `Only ${got} genuinely different cards are possible from this list, not ${want}. Add more items, or print ${got}.`,
    thin: (need: number) => `Your list barely covers one card (${need} squares), so every card holds almost the same items and differs only in where they sit — one call will mark nearly every card at once. Roughly double the list for a real game.`,
    unique: 'Every card is checked against the others, so no two children get the same one.',
    calls: 'Call list', copyCalls: 'Copy call list', copied: 'Copied!',
    callsWhy: 'Read from this order and the game stays fair — calling in the order you typed rewards whoever happens to have the top of your list.',
    card: (n: number) => `Card ${n}`,
  },
  ar: {
    items: 'العناصر — عنصر في كل سطر', placeholder: 'كلمة أو رقم في كل سطر',
    sample: 'حمّل قائمة تجريبية',
    size: 'الشبكة', count: 'عدد البطاقات',
    free: 'مربّع حر في الوسط', twoUp: 'بطاقتان في الصفحة',
    title: 'عنوان البطاقة', titlePlaceholder: 'الصف الرابع ب',
    seed: 'رمز المجموعة',
    seedWhy: 'الرمز نفسه ينتج المجموعة نفسها. أعد طباعة بطاقة تمزّقت فتبقى هي البطاقة التي كان يلعب بها ذلك الطالب.',
    regenerate: 'مجموعة جديدة',
    download: 'نزّل PDF', working: 'جارٍ التجهيز…',
    preview: 'البطاقة الأولى',
    pool: (n: number, need: number) => `${n} عنصرًا · ${need} مطلوبة لكل بطاقة`,
    tooFew: (need: number) => `العناصر غير كافية — البطاقة تحتاج ${need}. أضف أسطرًا أخرى.`,
    short: (got: number, want: number) => `لا يمكن من هذه القائمة سوى ${got} بطاقة مختلفة فعلًا، لا ${want}. أضف عناصر أو اطبع ${got}.`,
    thin: (need: number) => `قائمتك تكفي بطاقة واحدة بالكاد (${need} مربّعًا)، فكل بطاقة تحمل العناصر نفسها تقريبًا ولا تختلف إلا في مواضعها — والنداء الواحد سيعلّم على كل البطاقات تقريبًا دفعة واحدة. ضاعف القائمة تقريبًا للعبة حقيقية.`,
    unique: 'تُقارن كل بطاقة بغيرها، فلا يحصل طالبان على البطاقة نفسها.',
    calls: 'قائمة النداء', copyCalls: 'انسخ قائمة النداء', copied: 'تم النسخ!',
    callsWhy: 'اقرأ بهذا الترتيب يبقَ اللعب عادلًا — فالنداء بترتيب ما كتبته يكافئ من صادف أن لديه أوائل قائمتك.',
    card: (n: number) => `بطاقة ${n}`,
  },
}

export default function BingoCardsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('')
  const [o, setO] = useState<BingoOptions>({ ...DEFAULTS, seed: 'ABC123' })
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const set = <K extends keyof BingoOptions>(k: K, v: BingoOptions[K]) => setO((p) => ({ ...p, [k]: v }))
  const items = useMemo(() => raw.split('\n').map((x) => x.trim()).filter(Boolean), [raw])
  const opts = useMemo(() => ({ ...o, items }), [o, items])
  const result = useMemo(() => makeCards(opts), [opts])
  const pool = useMemo(() => [...new Set(items)], [items])

  async function download() {
    setBusy(true)
    try {
      const blob = await buildCards(result, opts, { card: s.card })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bingo-${o.seed}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy(false) }
  }

  async function copyCalls() {
    try {
      await navigator.clipboard.writeText(result.callList.join('\n'))
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  const first = result.cards[0]

  return (
    <Stack data-testid="bingo-cards">
      <Panel>
        <Field label={s.items}>
          <Textarea rows={6} value={raw} placeholder={s.placeholder} data-testid="bg-items"
            onChange={(e) => setRaw(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setRaw(SAMPLE[locale])} data-testid="bg-sample">{s.sample}</Button>
          <span className="text-[0.85rem] text-ink-faint" data-testid="bg-pool">{s.pool(pool.length, result.needed)}</span>
        </div>

        <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
          <Field label={s.size}>
            <Seg data-testid="bg-size">
              {[3, 4, 5].map((z) => (
                <SegButton key={z} active={o.size === z} onClick={() => set('size', z)} data-testid={`bg-size-${z}`}>
                  {z}×{z}
                </SegButton>
              ))}
            </Seg>
          </Field>
          <Field label={s.count}>
            <Input type="number" min={1} max={60} value={o.count} data-testid="bg-count"
              onChange={(e) => set('count', Math.min(60, Math.max(1, Number(e.target.value) || 1)))} />
          </Field>
          <Field label={s.title}>
            <Input value={o.title} placeholder={s.titlePlaceholder} data-testid="bg-title"
              onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label={s.seed}>
            <div className="flex gap-2">
              <Input value={o.seed} className="font-mono" data-testid="bg-seed"
                onChange={(e) => set('seed', e.target.value.toUpperCase())} />
              <Button className="px-3" onClick={() => set('seed', newSeed())} data-testid="bg-regenerate" aria-label={s.regenerate}>
                <RefreshIcon />
              </Button>
            </div>
          </Field>
        </div>

        <div className="flex flex-wrap gap-4">
          <Check><input type="checkbox" checked={o.freeSpace} data-testid="bg-free"
            onChange={(e) => set('freeSpace', e.target.checked)} /> {s.free}</Check>
          <Check><input type="checkbox" checked={o.twoUp} data-testid="bg-two-up"
            onChange={(e) => set('twoUp', e.target.checked)} /> {s.twoUp}</Check>
        </div>

        {result.tooFew && items.length > 0 && (
          <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="bg-too-few">{s.tooFew(result.needed)}</p>
        )}
        {result.short && (
          <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="bg-short">{s.short(result.cards.length, o.count)}</p>
        )}
        {result.thin && (
          <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="bg-thin">{s.thin(result.needed)}</p>
        )}

        <Button variant="primary" className="self-start" onClick={download} disabled={busy || !result.cards.length} data-testid="bg-download">
          <DownloadIcon /> {busy ? s.working : s.download}
        </Button>
        <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.seedWhy}</p>
      </Panel>

      {first && (
        <section className="flex flex-col gap-2">
          <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.preview}</h2>
          <div className="grid gap-px bg-[color:var(--line)] border border-[color:var(--line)] rounded-md overflow-hidden max-w-[26rem]"
            style={{ gridTemplateColumns: `repeat(${o.size}, minmax(0, 1fr))` }} data-testid="bg-preview">
            {first.map((cell, i) => (
              <div key={i} data-testid={`bg-cell-${i}`}
                className={`aspect-square flex items-center justify-center p-1 text-center text-[0.72rem] leading-tight ${cell === FREE ? 'bg-[color-mix(in_srgb,var(--color-green-400)_16%,var(--surface))] text-green-700 text-[1.2rem]' : 'bg-[var(--surface)] text-ink'}`}>
                {cell}
              </div>
            ))}
          </div>
          <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.unique}</p>
        </section>
      )}

      {result.callList.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.calls}</h2>
            <Button className="px-3 py-1" onClick={copyCalls} data-testid="bg-copy-calls">
              <CopyIcon /> {copied ? s.copied : s.copyCalls}
            </Button>
          </div>
          <ol className="flex flex-wrap gap-x-3 gap-y-1 text-[0.85rem] text-ink-soft" data-testid="bg-calls">
            {result.callList.map((c, i) => (
              <li key={c} className="whitespace-nowrap"><span className="text-ink-faint">{i + 1}.</span> {c}</li>
            ))}
          </ol>
          <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.callsWhy}</p>
        </section>
      )}
    </Stack>
  )
}
