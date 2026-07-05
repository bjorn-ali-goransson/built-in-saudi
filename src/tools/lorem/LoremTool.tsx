import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, RefreshIcon } from '../../components/icons'
import { Stack, Seg, SegButton, Input, Button } from '../../components/ui'

type Unit = 'paragraphs' | 'sentences' | 'words'
type Flavor = 'latin' | 'arabic'

const STR = {
  en: {
    amount: 'Amount', paragraphs: 'Paragraphs', sentences: 'Sentences', words: 'Words',
    flavor: 'Flavour', latin: 'Lorem ipsum', arabic: 'Arabic',
    startLorem: 'Start with “Lorem ipsum…”', copy: 'Copy', copied: 'Copied!', regenerate: 'Regenerate',
    output: 'Output',
  },
  ar: {
    amount: 'الكمية', paragraphs: 'فقرات', sentences: 'جُمل', words: 'كلمات',
    flavor: 'النوع', latin: 'لاتيني', arabic: 'عربي',
    startLorem: 'ابدأ بـ «Lorem ipsum…»', copy: 'نسخ', copied: 'تم النسخ!', regenerate: 'إعادة التوليد',
    output: 'الناتج',
  },
}

const LATIN = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ')
const ARABIC = 'لكن لا بد أن أوضح لك أن كل هذه الأفكار المغلوطة حول استنكار النشوة وتمجيد الألم نشأت بالفعل وسأعرض لك التفاصيل لتكتشف حقيقة وأساس تلك السعادة البشرية فلا أحد يرفض أو يكره أو يتجنب الشعور بالسعادة ولكن بفضل هؤلاء الأشخاص الذين لا يدركون بأن السعادة قد تكون أكثر تعقيدًا مما تبدو عليه دائمًا'.split(' ')

// Deterministic-ish PRNG seeded by a number so "Regenerate" changes output.
function makeRand(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function build(unit: Unit, count: number, flavor: Flavor, startLorem: boolean, seed: number): string {
  const rand = makeRand(seed)
  const bank = flavor === 'arabic' ? ARABIC : LATIN
  const pick = () => bank[Math.floor(rand() * bank.length)]
  const cap = (w: string) => (flavor === 'arabic' ? w : w.charAt(0).toUpperCase() + w.slice(1))

  const makeSentence = (first?: boolean): string => {
    const n = 6 + Math.floor(rand() * 9)
    const words: string[] = []
    for (let i = 0; i < n; i++) words.push(pick())
    if (first && startLorem && flavor === 'latin') words.splice(0, Math.min(5, words.length), 'lorem', 'ipsum', 'dolor', 'sit', 'amet')
    // add a comma somewhere
    if (n > 8) words[Math.floor(n / 2)] += flavor === 'arabic' ? '،' : ','
    return cap(words.join(' ')) + (flavor === 'arabic' ? '.' : '.')
  }

  if (unit === 'words') {
    const words: string[] = []
    for (let i = 0; i < count; i++) words.push(i === 0 && startLorem && flavor === 'latin' ? 'lorem' : pick())
    return cap(words.join(' '))
  }
  if (unit === 'sentences') {
    return Array.from({ length: count }, (_, i) => makeSentence(i === 0)).join(' ')
  }
  return Array.from({ length: count }, (_, p) =>
    Array.from({ length: 3 + Math.floor(rand() * 4) }, (_, i) => makeSentence(p === 0 && i === 0)).join(' '),
  ).join('\n\n')
}

export default function LoremTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [unit, setUnit] = useState<Unit>('paragraphs')
  const [count, setCount] = useState(3)
  const [flavor, setFlavor] = useState<Flavor>('latin')
  const [startLorem, setStartLorem] = useState(true)
  const [seed, setSeed] = useState(1)
  const [copied, setCopied] = useState(false)

  const text = useMemo(() => build(unit, count, flavor, startLorem, seed), [unit, count, flavor, startLorem, seed])

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="lorem" dir={flavor === 'arabic' ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap gap-[0.6rem] items-center" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <Seg role="group" aria-label={s.amount}>
          {(['paragraphs', 'sentences', 'words'] as Unit[]).map((u) => (
            <SegButton key={u} active={unit === u} aria-pressed={unit === u}
              data-testid={`lorem-unit-${u}`} onClick={() => setUnit(u)}>{s[u]}</SegButton>
          ))}
        </Seg>
        <Input className="w-20 text-center" type="number" min={1} max={100} value={count}
          data-testid="lorem-count" aria-label={s.amount} onChange={(e) => setCount(Math.min(100, Math.max(1, Number(e.target.value))))} />
        <Seg role="group" aria-label={s.flavor}>
          {(['latin', 'arabic'] as Flavor[]).map((f) => (
            <SegButton key={f} active={flavor === f} aria-pressed={flavor === f}
              data-testid={`lorem-flavor-${f}`} onClick={() => setFlavor(f)}>{s[f]}</SegButton>
          ))}
        </Seg>
      </div>

      {flavor === 'latin' && (
        <label className="flex items-center gap-[0.5rem] text-[0.9rem] text-ink-soft">
          <input type="checkbox" className="w-[22px] h-[22px] accent-green-600 flex-none" checked={startLorem} data-testid="lorem-start"
            onChange={(e) => setStartLorem(e.target.checked)} /> {s.startLorem}
        </label>
      )}

      <div className="flex gap-[0.6rem] mt-[0.6rem] [&>button]:flex-1 [&>button]:justify-center">
        <Button data-testid="lorem-regen" onClick={() => setSeed((v) => v + 1)}><RefreshIcon /> {s.regenerate}</Button>
        <Button variant="primary" data-testid="lorem-copy" onClick={copy}><CopyIcon /> {copied ? s.copied : s.copy}</Button>
      </div>

      <div className="p-[1.1rem] border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] leading-[1.7] [&_p]:mb-[0.9rem] [&_p:last-child]:mb-0" data-testid="lorem-out">
        {text.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </Stack>
  )
}
