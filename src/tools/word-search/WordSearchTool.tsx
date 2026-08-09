import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Stack, Panel, Field, Textarea, Input, Check, Seg, SegButton } from '../../components/ui'
import { DownloadIcon, RefreshIcon } from '../../components/icons'
import { newSeed, rng } from '../../lib/printPdf'
import { buildGrid, suggestSize, isArabic } from './grid'
import { buildPdf } from './render'

const SAMPLE_EN = 'Riyadh\nJeddah\nDammam\nMecca\nMedina\nTabuk\nAbha\nHail'
const SAMPLE_AR = 'الرياض\nجدة\nالدمام\nمكة\nالمدينة\nتبوك\nأبها\nحائل'

const STR = {
  en: {
    intro: 'Make a printable word search from your own list — English or Arabic — with an answer key. Everything is drawn in your browser; no list of pupils’ names or lesson words is uploaded anywhere.',
    title: 'Title', words: 'Words, one per line',
    size: 'Grid', dirs: 'Directions',
    d2: 'Forwards only', d4: '+ Vertical', d8: 'All 8',
    answers: 'Include an answer key',
    seed: 'Seed', reseed: 'New puzzle',
    download: 'Download the sheet',
    placed: (n: number, t: number) => `${n} of ${t} words placed`,
    rejected: (list: string) => `No room for: ${list}. Raise the grid size, or shorten the word.`,
    seedNote: 'The seed is printed on the sheet. Reprinting with the same seed gives you the same puzzle — which matters when the answer key in your hand belongs to it.',
    arabicNote: 'Arabic letters are matched the way a solver’s eye matches them: أ إ آ ا count as one letter, and so do ة/ه and ى/ي. Words read right-to-left, and the clue list keeps the spelling you typed.',
    empty: 'Add some words.',
  },
  ar: {
    intro: 'اصنع لعبة البحث عن الكلمات للطباعة من قائمتك — بالعربية أو الإنجليزية — مع ورقة الحل. يُرسم كل شيء في متصفحك؛ ولا تُرفع قائمة أسماء الطلاب ولا كلمات الدرس إلى أي مكان.',
    title: 'العنوان', words: 'الكلمات، كلمة في كل سطر',
    size: 'الشبكة', dirs: 'الاتجاهات',
    d2: 'أفقي فقط', d4: '+ رأسي', d8: 'الاتجاهات الثمانية',
    answers: 'أضف ورقة الحل',
    seed: 'الرمز', reseed: 'لغز جديد',
    download: 'نزّل الورقة',
    placed: (n: number, t: number) => `وُضعت ${n} كلمة من ${t}`,
    rejected: (list: string) => `لا مكان لـ: ${list}. كبّر الشبكة أو اختصر الكلمة.`,
    seedNote: 'يُطبع الرمز على الورقة. وإعادة الطباعة بالرمز نفسه تعطيك اللغز نفسه — وهذا ما يهم حين تكون ورقة الحل التي بيدك له.',
    arabicNote: 'تُطابَق الحروف العربية كما تطابقها عين الحلّال: أ إ آ ا حرف واحد، وكذلك ة/ه و ى/ي. وتُقرأ الكلمات من اليمين إلى اليسار، وتبقى في قائمة الكلمات بالإملاء الذي كتبته.',
    empty: 'أضف بعض الكلمات.',
  },
}

export default function WordSearchTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [title, setTitle] = useState(locale === 'ar' ? 'مدن المملكة' : 'Cities of the Kingdom')
  const [raw, setRaw] = useState(locale === 'ar' ? SAMPLE_AR : SAMPLE_EN)
  const [dirs, setDirs] = useState(8)
  const [answers, setAnswers] = useState(true)
  const [seed, setSeed] = useState(() => newSeed())
  const [busy, setBusy] = useState(false)

  const words = useMemo(
    () => raw.split('\n').map((w) => w.trim()).filter(Boolean),
    [raw],
  )
  const [size, setSize] = useState(0)
  const effSize = size || suggestSize(words)

  const grid = useMemo(
    () => buildGrid(words, effSize, dirs, rng(seed)),
    [words, effSize, dirs, seed],
  )

  async function download() {
    setBusy(true)
    try {
      const blob = await buildPdf({ title, grid, words, seed, answers, locale })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 50) || 'word-search'}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy(false) }
  }

  return (
    <Stack data-testid="word-search">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Field label={s.title}>
        <Input value={title} data-testid="ws-title" onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={s.words}>
        <Textarea rows={7} value={raw} data-testid="ws-words" onChange={(e) => setRaw(e.target.value)} />
      </Field>

      <div className="flex flex-wrap items-end gap-4">
        <Field label={`${s.size} — ${effSize} × ${effSize}`}>
          <input
            type="range" min={8} max={20} value={effSize} data-testid="ws-size"
            className="w-[12rem] accent-green-600"
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </Field>
        <Field label={s.dirs}>
          <Seg data-testid="ws-dirs">
            <SegButton active={dirs === 2} onClick={() => setDirs(2)} data-testid="ws-d2">{s.d2}</SegButton>
            <SegButton active={dirs === 4} onClick={() => setDirs(4)} data-testid="ws-d4">{s.d4}</SegButton>
            <SegButton active={dirs === 8} onClick={() => setDirs(8)} data-testid="ws-d8">{s.d8}</SegButton>
          </Seg>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Check><input type="checkbox" checked={answers} data-testid="ws-answers" onChange={(e) => setAnswers(e.target.checked)} /> {s.answers}</Check>
        {/* Editable, not a label. The sheet PRINTS the seed and the copy says
            reprinting with it gives the same puzzle — which was a promise the
            tool could not keep, because there was nowhere to type it back in.
            Caught by its own spec having to assert something weaker. */}
        <Field label={s.seed}>
          <Input className="w-[9rem] font-mono" value={seed} data-testid="ws-seed"
            onChange={(e) => setSeed(e.target.value)} />
        </Field>
        <Button className="px-3 py-1" onClick={() => setSeed(newSeed())} data-testid="ws-reseed"><RefreshIcon /> {s.reseed}</Button>
      </div>

      {words.length === 0
        ? <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="ws-empty">{s.empty}</p>
        : (
          <>
            <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="ws-placed">{s.placed(grid.placed.length, words.length)}</p>
            {grid.rejected.length > 0 && (
              <p className="text-[0.9rem] text-[color:var(--danger)] rtl:font-ar" data-testid="ws-rejected">
                {s.rejected(grid.rejected.join('، '))}
              </p>
            )}

            {/* An on-screen preview of the real grid, so the puzzle is judged
                before a sheet of paper is spent on it. */}
            <div className="overflow-x-auto">
              <div
                className="inline-grid gap-0 border border-[color:var(--line)] font-mono"
                style={{ gridTemplateColumns: `repeat(${effSize}, minmax(0, 1fr))` }}
                data-testid="ws-grid"
                dir="ltr"
              >
                {grid.cells.flatMap((row, r) => row.map((ch, c) => (
                  <span key={`${r}-${c}`} data-cell={`${r}-${c}`}
                    className="grid place-items-center w-[1.55rem] h-[1.55rem] text-[0.82rem] text-ink border border-[color:var(--line-soft)]">
                    {ch}
                  </span>
                )))}
              </div>
            </div>

            <Button variant="primary" onClick={download} disabled={busy || !grid.placed.length} data-testid="ws-download">
              <DownloadIcon /> {s.download}
            </Button>
          </>
        )}

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ws-seed-note">{s.seedNote}</p></Panel>
      {(isArabic(raw) || locale === 'ar') && (
        <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar" data-testid="ws-arabic-note">{s.arabicNote}</p></Panel>
      )}
    </Stack>
  )
}
