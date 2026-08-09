import { useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Stack, Panel, Field, Input, Textarea, Seg, SegButton } from '../../components/ui'
import {
  RATES, countWords, detectScript, isPoint, seconds, wordsInMinutes,
  type Mode, type Script,
} from '../../lib/readingRate'

const STR = {
  en: {
    intro: 'Paste a speech, a khutbah, a presentation or an article. Nothing is sent anywhere — the text stays in your browser.',
    label: 'Your script',
    placeholder: 'Paste or type the text you are going to read or deliver…',
    silent: 'Read silently', aloud: 'Said out loud',
    scriptAuto: (s: string) => `Detected: ${s}`,
    arabic: 'Arabic', latin: 'Latin script',
    words: 'words', wpm: 'words per minute',
    takes: 'Takes', about: 'about',
    rate: 'Rate', custom: 'Set the rate yourself',
    fitTitle: 'The other way round: how many words fit?',
    fitBody: 'You usually know how long you have, not how long you have written.',
    minutes: 'Minutes available', budget: 'Word budget',
    arTitle: 'Arabic is not read at an English rate, and every other calculator uses one',
    arBody: 'On the standardized international reading test — one text, translated into 17 languages, 436 readers, same font size and distance — English came out at 228 words a minute and Arabic at 138. That is a 73% difference, because an Arabic word packs more in and the short vowels are not written, so each word costs more work. A "words to minutes" calculator that applies an English figure to an Arabic script overstates how much you can fit by nearly half.',
    disTitle: 'The two Arabic speaking studies disagree, so this is a range',
    disBody: 'Adult Jordanian speakers were measured at 140 words a minute reading aloud and adult Syrian speakers at 104 — a 35% spread, and the two do not even agree on whether Arabic is read aloud faster or slower than it is spoken off the cuff. Averaging them would produce a number that is nobody\'s, so the endpoints are shown instead. A range is the honest answer to a question that genuinely varies by speaker anyway.',
    pointTitle: 'One published figure, not a range',
    pointBody: 'Only a single standardized figure is published for silent reading in Arabic, so there is no honest band to draw around it. Set the rate yourself if you read faster or slower than average.',
    counter: 'Just counting words and characters: Word Counter',
    sourcesTitle: 'Where the rates come from',
    sources: [
      'Silent reading, Latin script — Brysbaert (2019), a meta-analysis of 190 studies: mean 238 wpm, normal range 175–300.',
      'Silent reading, Arabic — International Reading Speed Texts (Trauzettel-Klosinski & Dietz, 2012), 436 readers across 17 languages: 138 wpm.',
      'Speaking aloud, Latin script — National Center for Voice and Speech: about 150 wpm conversational; 100–150 is the usual presentation band.',
      'Speaking aloud, Arabic — two normative studies of adult Jordanian and adult Syrian speakers: 140 and 104 wpm reading aloud.',
    ],
  },
  ar: {
    intro: 'ألصق خطبة أو عرضًا تقديميًا أو مقالًا. ولا يُرسل شيء إلى أي مكان — يبقى النص في متصفحك.',
    label: 'نصّك',
    placeholder: 'ألصق أو اكتب النص الذي ستقرؤه أو تلقيه…',
    silent: 'قراءة صامتة', aloud: 'إلقاء بصوت عالٍ',
    scriptAuto: (s: string) => `المكتشف: ${s}`,
    arabic: 'العربية', latin: 'الحرف اللاتيني',
    words: 'كلمة', wpm: 'كلمة في الدقيقة',
    takes: 'يستغرق', about: 'نحو',
    rate: 'المعدّل', custom: 'حدّد المعدّل بنفسك',
    fitTitle: 'والعكس: كم كلمة تكفي؟',
    fitBody: 'أنت غالبًا تعرف الوقت المتاح لا طول ما كتبت.',
    minutes: 'الدقائق المتاحة', budget: 'عدد الكلمات',
    arTitle: 'العربية لا تُقرأ بمعدّل الإنجليزية، وكل حاسبة أخرى تستعمل معدّلها',
    arBody: 'في اختبار سرعة القراءة الدولي الموحّد — نصّ واحد مترجم إلى ١٧ لغة، و٤٣٦ قارئًا، بالخط والمسافة نفسها — جاءت الإنجليزية ٢٢٨ كلمة في الدقيقة والعربية ١٣٨. أي فارق ٧٣٪، لأن الكلمة العربية تحمل أكثر ولأن الحركات القصيرة لا تُكتب، فتكلّف كل كلمة جهدًا أكبر. وحاسبة تطبّق رقمًا إنجليزيًا على نصّ عربي تبالغ فيما يمكنك أن تقوله بنحو النصف.',
    disTitle: 'الدراستان العربيتان تختلفان، فالجواب نطاق لا رقم',
    disBody: 'قيس المتحدثون الأردنيون البالغون عند ١٤٠ كلمة في الدقيقة قراءةً بصوت عالٍ، والسوريون عند ١٠٤ — أي فارق ٣٥٪، بل لا تتفق الدراستان حتى على ما إذا كانت العربية تُقرأ جهرًا أسرع أم أبطأ من الكلام العفوي. وحساب المتوسط بينهما يعطي رقمًا ليس لأحد، فتُعرض الحدود بدلًا منه. والنطاق هو الجواب الصادق لسؤال يختلف باختلاف المتحدث أصلًا.',
    pointTitle: 'رقم منشور واحد لا نطاق',
    pointBody: 'لا يوجد إلا رقم موحّد واحد منشور للقراءة الصامتة بالعربية، فلا نطاق صادقًا يُرسم حوله. حدّد المعدّل بنفسك إن كنت تقرأ أسرع أو أبطأ من المتوسط.',
    counter: 'لعدّ الكلمات والحروف فقط: عدّاد الكلمات',
    sourcesTitle: 'من أين جاءت المعدّلات',
    sources: [
      'القراءة الصامتة بالحرف اللاتيني — برايسبارت (٢٠١٩)، تحليل بَعدي لـ١٩٠ دراسة: المتوسط ٢٣٨ كلمة/دقيقة، والنطاق المعتاد ١٧٥–٣٠٠.',
      'القراءة الصامتة بالعربية — نصوص سرعة القراءة الدولية (تراوتسيتل-كلوزينسكي وديتس، ٢٠١٢)، ٤٣٦ قارئًا في ١٧ لغة: ١٣٨ كلمة/دقيقة.',
      'الإلقاء بالحرف اللاتيني — المركز الوطني للصوت والكلام: نحو ١٥٠ كلمة/دقيقة في الحديث العادي، و١٠٠–١٥٠ نطاق العروض التقديمية.',
      'الإلقاء بالعربية — دراستان معياريتان لمتحدثين أردنيين وسوريين بالغين: ١٤٠ و١٠٤ كلمة/دقيقة قراءةً بصوت عالٍ.',
    ],
  },
}

/** m:ss, because "2.4 minutes" is not a thing anybody can act on. */
function clock(sec: number, locale: 'en' | 'ar'): string {
  const total = Math.round(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  const n = (v: number, pad = false) => {
    const str = pad ? String(v).padStart(2, '0') : String(v)
    return locale === 'ar' ? str.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]) : str
  }
  return `${n(m)}:${n(s, true)}`
}

export default function SpeechTimeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [mode, setMode] = useState<Mode>('aloud')
  const [override, setOverride] = useState<Script | null>(null)
  const [custom, setCustom] = useState('')
  const [target, setTarget] = useState('10')

  const words = useMemo(() => countWords(text), [text])
  const detected = useMemo(() => detectScript(text), [text])
  const script = override ?? detected
  const rate = RATES[script][mode]

  const customWpm = Number(custom) > 0 ? Number(custom) : null
  const slow = customWpm ?? rate.slow
  const fast = customWpm ?? rate.fast
  // The slower rate takes LONGER, so it is the upper bound of the time.
  const longest = seconds(words, slow)
  const shortest = seconds(words, fast)
  const one = customWpm !== null || isPoint(rate)

  const num = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')
  const minutes = Number(target) || 0

  return (
    <Stack data-testid="speech-time">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Field label={s.label}>
        <Textarea rows={7} value={text} placeholder={s.placeholder}
          data-testid="st-text" onChange={(e) => setText(e.target.value)} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Seg>
          <SegButton active={mode === 'silent'} data-testid="st-silent" onClick={() => setMode('silent')}>{s.silent}</SegButton>
          <SegButton active={mode === 'aloud'} data-testid="st-aloud" onClick={() => setMode('aloud')}>{s.aloud}</SegButton>
        </Seg>
        <Seg>
          <SegButton active={script === 'latin'} data-testid="st-latin" onClick={() => setOverride('latin')}>{s.latin}</SegButton>
          <SegButton active={script === 'arabic'} data-testid="st-arabic" onClick={() => setOverride('arabic')}>{s.arabic}</SegButton>
        </Seg>
        <Field label={s.custom}>
          <Input type="number" min={40} max={600} className="w-[7rem]" value={custom}
            placeholder={String(rate.slow)} data-testid="st-custom" onChange={(e) => setCustom(e.target.value)} />
        </Field>
      </div>

      <Panel className="gap-2">
        <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.takes}</div>
        <div className="font-display text-[2.2rem] leading-none text-green-700" data-testid="st-time">
          {one ? clock(longest, locale) : `${clock(shortest, locale)} – ${clock(longest, locale)}`}
        </div>
        <div className="text-[0.88rem] text-ink-faint rtl:font-ar" data-testid="st-working">
          {num(words)} {s.words} · {one ? num(slow) : `${num(fast)}–${num(slow)}`} {s.wpm}
        </div>
      </Panel>

      {/* The inverse, which is the question people actually arrive with. */}
      <Panel className="gap-2">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.fitTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.fitBody}</p>
        <div className="flex flex-wrap items-end gap-4">
          <Field label={s.minutes}>
            <Input type="number" min={1} max={600} className="w-[6rem]" value={target}
              data-testid="st-target" onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.budget}</div>
            <div className="font-mono text-[1.5rem] text-ink" data-testid="st-budget">
              {one
                ? num(wordsInMinutes(minutes, slow))
                : `${num(wordsInMinutes(minutes, slow))}–${num(wordsInMinutes(minutes, fast))}`}
            </div>
          </div>
        </div>
      </Panel>

      {/* Why this tool exists rather than any of the eight sites that already
          do words-to-minutes: they all apply an English rate to any script. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.arTitle}</div>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="st-arabic-note">{s.arBody}</p>
      </Panel>

      {script === 'arabic' && mode === 'aloud' && (
        <Panel className="gap-1">
          <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.disTitle}</div>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="st-disagree">{s.disBody}</p>
        </Panel>
      )}

      {script === 'arabic' && mode === 'silent' && (
        <Panel className="gap-1">
          <div role="heading" aria-level={2} className="font-display text-[1.05rem] text-ink rtl:font-ar">{s.pointTitle}</div>
          <p className="text-[0.9rem] text-ink-soft rtl:font-ar" data-testid="st-point">{s.pointBody}</p>
        </Panel>
      )}

      {/* No <Disclaimer>: this estimates neither money, health, an entitlement
          nor an official deadline, and the five kinds mean something precisely
          because they are not stretched to cover everything. The sources are
          named outright instead, which is what a reader needs here. */}
      <Panel className="gap-1">
        <div role="heading" aria-level={2} className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint rtl:font-ar">{s.sourcesTitle}</div>
        <ul className="text-[0.82rem] text-ink-faint list-disc ps-5 rtl:font-ar" data-testid="st-sources">
          {s.sources.map((line) => <li key={line} className="py-[0.15rem]">{line}</li>)}
        </ul>
      </Panel>

      <Button className="self-start px-3 py-1" to={localePath(locale, '/apps/text-counter')} data-testid="st-counter">{s.counter}</Button>
    </Stack>
  )
}
