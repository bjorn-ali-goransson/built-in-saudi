import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Select, Stack, Seg, SegButton, Check, Panel, CodeOut } from '../../components/ui'
import { CopyIcon, RefreshIcon, DiceIcon } from '../../components/icons'
import { LISTS, diceFor, rollToIndex, type ListId } from './wordlist'

// Unbiased index via rejection sampling — a plain modulo of a 32-bit value skews
// toward the low words when the list size does not divide 2^32.
function randIndex(n: number): number {
  const limit = Math.floor(0xffffffff / n) * n
  const buf = new Uint32Array(1)
  let v = 0
  do { crypto.getRandomValues(buf); v = buf[0] } while (v >= limit)
  return v % n
}

const SEPARATORS = [
  { id: '-', label: 'word-word' },
  { id: '.', label: 'word.word' },
  { id: ' ', label: 'word word' },
  { id: '_', label: 'word_word' },
  { id: '', label: 'wordword' },
]

const STR = {
  en: {
    list: 'Wordlist', words: 'Words', separator: 'Separator',
    capitalise: 'Capitalise each word', number: 'Add a number',
    source: 'Where the randomness comes from',
    computer: 'This device', dice: 'Physical dice',
    generate: 'Generate', copy: 'Copy', copied: 'Copied!',
    entropy: 'Entropy', bits: 'bits',
    perWord: (n: number, b: string) => `${n.toLocaleString('en')} words · ${b} bits each`,
    crack: 'An attacker guessing offline would need about',
    strengths: { weak: 'Weak', fair: 'Fair', strong: 'Strong', excellent: 'Excellent' } as Record<string, string>,
    diceHow: (n: number) => `Roll ${n} dice, type the numbers, repeat for each word.`,
    diceInput: 'Your rolls', dicePlaceholder: '4 2 6 1',
    diceAdd: 'Add word', diceClear: 'Start over',
    diceBad: 'Each roll needs that many numbers, all between 1 and 6.',
    diceWhy: 'Dice are the honest version of this. Everything else here trusts your browser’s random number generator — and us. A die in your hand does not.',
    why: 'Four unrelated words beat a short password with symbols bolted on, and you can actually remember them. Length is what makes a passphrase strong; the punctuation barely matters.',
    reuse: 'Never reuse this anywhere. A passphrase is only as strong as the one place it is used.',
  },
  ar: {
    list: 'قائمة الكلمات', words: 'عدد الكلمات', separator: 'الفاصل',
    capitalise: 'ابدأ كل كلمة بحرف كبير', number: 'أضف رقمًا',
    source: 'من أين تأتي العشوائية',
    computer: 'هذا الجهاز', dice: 'نرد حقيقي',
    generate: 'ولّد', copy: 'نسخ', copied: 'تم النسخ!',
    entropy: 'العشوائية', bits: 'بت',
    perWord: (n: number, b: string) => `${n.toLocaleString('ar')} كلمة · ${b} بت لكل كلمة`,
    crack: 'يحتاج مهاجم يخمّن دون اتصال نحو',
    strengths: { weak: 'ضعيفة', fair: 'مقبولة', strong: 'قوية', excellent: 'ممتازة' } as Record<string, string>,
    diceHow: (n: number) => `ارمِ ${n.toLocaleString('ar')} نردات، واكتب الأرقام، وكرّر لكل كلمة.`,
    diceInput: 'رمياتك', dicePlaceholder: '٤ ٢ ٦ ١',
    diceAdd: 'أضف كلمة', diceClear: 'ابدأ من جديد',
    diceBad: 'كل رمية تحتاج ذلك العدد من الأرقام، وكلها بين ١ و٦.',
    diceWhy: 'النرد هو النسخة الصادقة من هذا. فكل ما عداه هنا يثق بمولّد العشوائية في متصفحك — وبنا. أما النرد في يدك فلا.',
    why: 'أربع كلمات غير مترابطة تتفوّق على كلمة مرور قصيرة أُضيفت إليها رموز، ويمكنك تذكّرها فعلًا. الطول هو ما يمنح العبارة قوتها، وعلامات الترقيم بالكاد تُذكر.',
    reuse: 'لا تُعِد استخدامها في أي مكان آخر. فقوة العبارة لا تتجاوز المكان الوحيد الذي تُستخدم فيه.',
  },
}

function humanTime(bits: number, locale: 'en' | 'ar'): string {
  // 1e11 guesses/second — commodity GPUs against a fast hash, the pessimistic case.
  const seconds = 2 ** bits / 2 / 1e11
  const ar = locale === 'ar'
  if (seconds < 1) return ar ? 'أقل من ثانية' : 'less than a second'
  const steps: [number, string, string][] = [
    [60, 'seconds', 'ثانية'], [60, 'minutes', 'دقيقة'], [24, 'hours', 'ساعة'], [365, 'days', 'يوم'],
  ]
  let n = seconds
  for (const [div, en, arName] of steps) {
    if (n < div) {
      const v = Math.round(n)
      return ar ? `${v.toLocaleString('ar')} ${arName}` : `${v} ${en}`
    }
    n /= div
  }
  if (n >= 1e12) return ar ? 'أطول من عمر الكون بكثير' : 'far longer than the universe has existed'
  if (n >= 1e9) return ar ? `${(n / 1e9).toFixed(0)} مليار سنة` : `${(n / 1e9).toFixed(0)} billion years`
  if (n >= 1e6) return ar ? `${(n / 1e6).toFixed(0)} مليون سنة` : `${(n / 1e6).toFixed(0)} million years`
  if (n >= 1e3) return ar ? `${(n / 1e3).toFixed(0)} ألف سنة` : `${(n / 1e3).toFixed(0)} thousand years`
  return ar ? `${Math.round(n).toLocaleString('ar')} سنة` : `${Math.round(n)} years`
}

export default function PassphraseTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [listId, setListId] = useState<ListId>(locale === 'ar' ? 'ar' : 'en')
  const [count, setCount] = useState(5)
  const [separator, setSeparator] = useState('-')
  const [capitalise, setCapitalise] = useState(false)
  const [number, setNumber] = useState(false)
  const [source, setSource] = useState<'device' | 'dice'>('device')
  const [words, setWords] = useState<string[]>([])
  const [rolls, setRolls] = useState('')
  const [rollError, setRollError] = useState('')
  const [copied, setCopied] = useState(false)

  const list = LISTS[listId].words
  const dicePerWord = diceFor(list.length) ?? 0

  const generate = useCallback(() => {
    setWords(Array.from({ length: count }, () => list[randIndex(list.length)]))
  }, [count, list])

  useEffect(() => { if (source === 'device') generate() }, [source, generate])
  // Switching list or source starts a dice phrase over — mixing lists mid-phrase
  // would make the entropy figure a lie.
  useEffect(() => { if (source === 'dice') { setWords([]); setRolls(''); setRollError('') } }, [source, listId])

  function addRoll() {
    const nums = rolls.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .match(/\d/g)?.map(Number) ?? []
    const index = rollToIndex(nums, list.length)
    if (index === null) { setRollError(s.diceBad); return }
    setWords((w) => [...w, list[index]])
    setRolls('')
    setRollError('')
  }

  const phrase = useMemo(() => {
    const parts = words.map((w) => (capitalise ? w[0].toUpperCase() + w.slice(1) : w))
    let out = parts.join(separator)
    if (number && parts.length) out += (separator || '-') + (10 + randIndex(90))
    return out
    // A fresh number on every keystroke would be noise; it changes with the words.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, capitalise, separator, number])

  const bits = words.length * Math.log2(list.length) + (number ? Math.log2(90) : 0)
  const strength = bits < 40 ? 'weak' : bits < 60 ? 'fair' : bits < 90 ? 'strong' : 'excellent'
  const tone = bits < 40 ? 'text-gold-500' : bits < 60 ? 'text-ink' : 'text-green-700'

  async function copy() {
    if (!phrase) return
    try { await navigator.clipboard.writeText(phrase); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="passphrase">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.list}
          <Select className="w-32" data-testid="pp-list" value={listId} onChange={(e) => setListId(e.target.value as ListId)}>
            {(Object.keys(LISTS) as ListId[]).map((k) => (
              <option key={k} value={k}>{LISTS[k].label[locale]}</option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.words}
          <Input type="number" min={3} max={12} dir="ltr" className="w-20 font-mono" data-testid="pp-count"
            value={count} onChange={(e) => setCount(Math.max(3, Math.min(12, +e.target.value || 5)))} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.separator}
          <Select className="w-32 font-mono" data-testid="pp-separator" value={separator} onChange={(e) => setSeparator(e.target.value)}>
            {SEPARATORS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </Select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[0.8rem] text-ink-faint">{s.source}</span>
          <Seg>
            <SegButton active={source === 'device'} data-testid="pp-src-device" onClick={() => setSource('device')}>{s.computer}</SegButton>
            <SegButton active={source === 'dice'} data-testid="pp-src-dice" onClick={() => setSource('dice')}>{s.dice}</SegButton>
          </Seg>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Check>
          <input type="checkbox" checked={capitalise} data-testid="pp-caps" onChange={(e) => setCapitalise(e.target.checked)} /> {s.capitalise}
        </Check>
        <Check>
          <input type="checkbox" checked={number} data-testid="pp-number" onChange={(e) => setNumber(e.target.checked)} /> {s.number}
        </Check>
      </div>

      {source === 'dice' && (
        <Panel className="flex flex-col gap-2">
          <span className="text-[0.9rem] text-ink rtl:font-ar" data-testid="pp-dice-how">{s.diceHow(dicePerWord)}</span>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
              {s.diceInput}
              <Input dir="ltr" className="w-40 font-mono text-[1.05rem]" data-testid="pp-rolls"
                placeholder={s.dicePlaceholder} value={rolls}
                onChange={(e) => { setRolls(e.target.value); setRollError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') addRoll() }} />
            </label>
            <Button onClick={addRoll} data-testid="pp-dice-add"><DiceIcon /> {s.diceAdd}</Button>
            {words.length > 0 && (
              <Button onClick={() => { setWords([]); setRolls('') }} data-testid="pp-dice-clear">{s.diceClear}</Button>
            )}
          </div>
          {rollError && <span className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="pp-dice-error">{rollError}</span>}
          <span className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.diceWhy}</span>
        </Panel>
      )}

      {phrase && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">
              {s.perWord(list.length, Math.log2(list.length).toFixed(2))}
            </span>
            {source === 'device' && (
              <Button className="px-3 py-1" onClick={generate} data-testid="pp-regen"><RefreshIcon /> {s.generate}</Button>
            )}
            <Button className="px-3 py-1" onClick={copy} data-testid="pp-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
          <CodeOut data-testid="pp-phrase">{phrase}</CodeOut>

          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-[0.9rem]">
              <span className="text-ink-faint rtl:font-ar">{s.entropy}: </span>
              <b className={`font-mono ${tone}`} data-testid="pp-bits">{Math.round(bits)} {s.bits}</b>
              <span className={`ms-2 rtl:font-ar ${tone}`} data-testid="pp-strength">{s.strengths[strength]}</span>
            </span>
            <span className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="pp-crack">
              {s.crack} <b>{humanTime(bits, locale)}</b>
            </span>
          </div>
        </>
      )}

      <p className="text-[0.88rem] text-ink-soft rtl:font-ar">{s.why}</p>
      <p className="text-[0.85rem] text-gold-500 rtl:font-ar">{s.reuse}</p>
    </Stack>
  )
}
