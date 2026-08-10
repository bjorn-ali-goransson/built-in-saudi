import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Stack, Panel, Field, Input, Seg, SegButton, Button } from '../../components/ui'
import { countWords } from '../../lib/readingRate'
import {
  ENCODINGS, costOf, isMostlyArabic, ruleError, ruleOfThumb, type Encoding,
} from './tokens'
import type { TokenReq, TokenRes } from './tokenize.worker'

const STR = {
  en: {
    intro: 'Paste a prompt, a document or a system message. It is tokenized in your browser with the real tokenizer — nothing is sent anywhere.',
    label: 'Your text', placeholder: 'Paste the text you are going to send to a model…',
    tokens: 'tokens', chars: 'characters', words: 'words', perToken: 'characters per token',
    counting: 'Tokenizing…', model: 'Tokenizer',
    ruleTitle: 'What "characters ÷ 4" would have told you',
    over: 'overestimates', under: 'UNDERESTIMATES', by: 'by',
    exact: 'is exactly right here',
    compare: 'Compare with the other tokenizer',
    comparing: 'Loading…',
    cheaper: 'cheaper on', dearer: 'more expensive on', same: 'the same on both',
    ctxTitle: 'Does it fit?', ctxLabel: 'Context window (tokens)',
    ctxUsed: 'of the window', ctxFits: 'copies fit', ctxOver: 'This does not fit — it is over by',
    priceTitle: 'What it costs', priceLabel: 'Price per million tokens',
    priceHelp: 'Read this off your provider\'s pricing page. No price table is built in — see below.',
    cost: 'Cost for this text',
    arTitle: 'Arabic cost four times as much per character, and the newer tokenizer mostly fixed it',
    arBody: 'Measured with the real tokenizers on one paragraph written in each language: English runs at about 5.8 characters per token and is barely affected by which tokenizer you use. Arabic ran at 1.41 characters per token on cl100k and runs at 3.80 on o200k — a 2.7x improvement. So the same Arabic text billed roughly four times what the English did on the older tokenizer, and filled a context window four times faster. For Arabic, and only for Arabic, which model you choose changes the bill far more than how you word the prompt.',
    ruleBody: 'The estimate is not a rule, it is an English rule. On ordinary English prose it overstates the count by about 45%; on source code it understates it by about 31%. Being wrong in both directions depending on what you paste is the worst property an estimate can have, which is why this counts rather than estimates.',
    priceWhyTitle: 'Why there is no list of model prices here',
    priceWhyBody: 'They change every few months, and they differ by provider, by tier, and between input and output. A built-in table would put a number on this page that nobody can stand behind — so the price is something you type, read off the page where it is current by definition. The arithmetic is one multiplication; the number is the part that goes stale.',
    privTitle: 'Why this matters more than it sounds',
    privBody: 'A token counter is a box you paste a prompt into — and a prompt is often the most confidential thing a team writes, carrying customer records, internal policy or unreleased work. Most counters on the web post that text to a server to count it. This one loads the tokenizer into your browser and counts it here, so the text never leaves the page.',
    related: 'Counting words and characters instead: Word Counter',
  },
  ar: {
    intro: 'ألصق تعليمة أو مستندًا أو رسالة نظام. تُحسب الرموز داخل متصفحك بالمُجزّئ الحقيقي — ولا يُرسل شيء إلى أي مكان.',
    label: 'نصّك', placeholder: 'ألصق النص الذي ستُرسله إلى النموذج…',
    tokens: 'توكن', chars: 'حرفًا', words: 'كلمة', perToken: 'حرفًا لكل توكن',
    counting: 'جارٍ التجزئة…', model: 'المُجزّئ',
    ruleTitle: 'ماذا كانت ستقول قاعدة «الحروف ÷ ٤»',
    over: 'تبالغ', under: 'تُقلّل', by: 'بنسبة',
    exact: 'مطابقة تمامًا هنا',
    compare: 'قارن بالمُجزّئ الآخر',
    comparing: 'جارٍ التحميل…',
    cheaper: 'أرخص على', dearer: 'أغلى على', same: 'متساوٍ على الاثنين',
    ctxTitle: 'هل يتّسع؟', ctxLabel: 'حجم النافذة (توكن)',
    ctxUsed: 'من النافذة', ctxFits: 'نسخة تتّسع', ctxOver: 'لا يتّسع — يزيد بمقدار',
    priceTitle: 'كم يكلّف', priceLabel: 'السعر لكل مليون توكن',
    priceHelp: 'اقرأه من صفحة أسعار مزوّدك. لا يوجد جدول أسعار مدمج — والسبب أدناه.',
    cost: 'تكلفة هذا النص',
    arTitle: 'العربية كانت تكلّف أربعة أضعاف الإنجليزية لكل حرف، والمُجزّئ الأحدث أصلح معظم ذلك',
    arBody: 'قياسًا بالمُجزّئات الحقيقية على فقرة واحدة مكتوبة بكل لغة: الإنجليزية نحو ٥٫٨ حرف لكل توكن ولا يكاد يؤثّر فيها اختيار المُجزّئ. أما العربية فكانت ١٫٤١ حرف لكل توكن على cl100k وصارت ٣٫٨٠ على o200k — أي تحسّن ٢٫٧ مرة. فالنص العربي نفسه كان يكلّف نحو أربعة أضعاف ما يكلّفه الإنجليزي على المُجزّئ الأقدم، ويملأ النافذة أربع مرات أسرع. وللعربية وحدها، اختيار النموذج يغيّر الفاتورة أكثر بكثير من صياغة التعليمة.',
    ruleBody: 'التقدير ليس قاعدة عامة بل قاعدة إنجليزية. على النثر الإنجليزي العادي يبالغ بنحو ٤٥٪، وعلى الشيفرة يُقلّل بنحو ٣١٪. وأن يخطئ في الاتجاهين حسب ما تُلصقه هو أسوأ ما في تقدير، ولهذا يَعُدّ هذا التطبيق ولا يُقدّر.',
    priceWhyTitle: 'لماذا لا توجد قائمة أسعار هنا',
    priceWhyBody: 'الأسعار تتغيّر كل بضعة أشهر، وتختلف بالمزوّد وبالفئة وبين المدخلات والمخرجات. وجدول مدمج يضع رقمًا لا يستطيع أحد أن يقف خلفه — فالسعر شيء تكتبه أنت، مقروءًا من الصفحة التي هو فيها محدّث بحكم التعريف. والحساب ضربة واحدة؛ الرقم هو ما يَقدُم.',
    privTitle: 'لماذا هذا أهم مما يبدو',
    privBody: 'عدّاد التوكنز صندوق تُلصق فيه تعليمتك — والتعليمة غالبًا أكثر ما يكتبه الفريق سرّية، تحمل بيانات عملاء أو سياسات داخلية أو عملًا لم يُنشر. ومعظم العدّادات على الويب تُرسل ذلك النص إلى خادم لتَعُدّه. هذا يُحمّل المُجزّئ في متصفحك ويَعُدّ هنا، فلا يغادر النص الصفحة.',
    related: 'لعدّ الكلمات والحروف بدلًا من ذلك: عدّاد الكلمات',
  },
}

export default function TokenCounterTool() {
  const { locale } = useLocale()
  const s = STR[locale === 'ar' ? 'ar' : 'en']
  const nf = useMemo(() => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-GB'), [locale])
  const money = useMemo(
    () => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', { maximumFractionDigits: 6 }),
    [locale],
  )

  const [text, setText] = useState('')
  const [enc, setEnc] = useState<Encoding>('o200k')
  // Counts are keyed by encoding and cleared whenever the text changes, so a
  // stale number can never be shown beside a new document.
  const [counts, setCounts] = useState<Partial<Record<Encoding, number>>>({})
  const [busy, setBusy] = useState<Encoding | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const reqRef = useRef(0)
  useEffect(() => {
    const w = new Worker(new URL('./tokenize.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = w
    return () => { w.terminate() }
  }, [])

  const ask = (t: string, e: Encoding) => {
    const w = workerRef.current
    if (!w) return
    const id = ++reqRef.current
    setBusy(e)
    const onMsg = (ev: MessageEvent<TokenRes>) => {
      // Drop a stale response — the text may have moved on since it was asked.
      if (ev.data.id !== reqRef.current) return
      w.removeEventListener('message', onMsg)
      setBusy(null)
      if (!ev.data.error) setCounts((c) => ({ ...c, [ev.data.enc]: ev.data.tokens }))
    }
    w.addEventListener('message', onMsg)
    const req: TokenReq = { id, text: t, enc: e }
    w.postMessage(req)
  }

  // Debounced: tokenizing on every keystroke is real work over a long document.
  useEffect(() => {
    setCounts({})
    if (!text) return
    const t = window.setTimeout(() => ask(text, enc), 250)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, enc])

  const tokens = counts[enc]
  const chars = text.length
  const words = countWords(text)
  const other = ENCODINGS.find((e) => e.id !== enc)!
  const otherCount = counts[other.id]

  const [ctx, setCtx] = useState('128000')
  const ctxN = Math.max(0, Number(ctx) || 0)
  const [price, setPrice] = useState('')
  const priceN = price.trim() === '' ? null : Number(price)
  const cost = tokens === undefined ? null : costOf(tokens, priceN)

  const err = tokens === undefined ? null : ruleError(chars, tokens)
  const arabic = isMostlyArabic(text)

  return (
    <Stack data-testid="token-counter">
      <p className="text-ink-faint">{s.intro}</p>

      <Field label={s.label}>
        <textarea
          className="w-full min-h-[9rem] p-3 rounded-md border border-line bg-surface text-ink [font:inherit] resize-y"
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder={s.placeholder} data-testid="tc-input" dir="auto"
        />
      </Field>

      <Field label={s.model}>
        <Seg>
          {ENCODINGS.map((e) => (
            <SegButton key={e.id} active={enc === e.id} onClick={() => setEnc(e.id)}
              data-testid={`tc-enc-${e.id}`}>
              {locale === 'ar' ? e.ar : e.en}
            </SegButton>
          ))}
        </Seg>
      </Field>

      <Panel>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div>
            <span className="font-display text-[2.2rem] leading-none" data-testid="tc-count">
              {tokens === undefined ? '—' : nf.format(tokens)}
            </span>
            <span className="ms-2 text-ink-faint">{s.tokens}</span>
          </div>
          <div className="text-ink-faint" data-testid="tc-chars">{nf.format(chars)} {s.chars}</div>
          <div className="text-ink-faint" data-testid="tc-words">{nf.format(words)} {s.words}</div>
          {tokens ? (
            <div className="text-ink-faint" data-testid="tc-per-token">
              {nf.format(Number((chars / tokens).toFixed(2)))} {s.perToken}
            </div>
          ) : null}
          {busy ? <div className="text-ink-faint" data-testid="tc-busy">{s.counting}</div> : null}
        </div>
      </Panel>

      {tokens !== undefined && chars > 0 ? (
        <Panel>
          <h3 className="font-display text-lg">{s.ruleTitle}</h3>
          <p data-testid="tc-rule">
            {nf.format(ruleOfThumb(chars))} {s.tokens} — {err === null || Math.abs(err) < 0.5
              ? s.exact
              : `${err > 0 ? s.over : s.under} ${s.by} ${nf.format(Math.abs(Math.round(err)))}%`}
          </p>
          <p className="text-ink-faint text-sm">{s.ruleBody}</p>
        </Panel>
      ) : null}

      {tokens !== undefined ? (
        <Panel>
          <div className="flex flex-wrap items-center gap-3">
            {otherCount === undefined ? (
              <Button onClick={() => ask(text, other.id)} disabled={busy !== null}
                data-testid="tc-compare">
                {busy === other.id ? s.comparing : s.compare}
              </Button>
            ) : (
              <p data-testid="tc-other">
                {locale === 'ar' ? other.ar : other.en}: {nf.format(otherCount)} {s.tokens}
                {' — '}
                {otherCount === tokens ? s.same
                  : otherCount > tokens
                    ? `${nf.format(Math.round(((otherCount - tokens) / tokens) * 100))}% ${s.dearer} ${other.label}`
                    : `${nf.format(Math.round(((tokens - otherCount) / otherCount) * 100))}% ${s.dearer} ${ENCODINGS.find((e) => e.id === enc)!.label}`}
              </p>
            )}
          </div>
        </Panel>
      ) : null}

      {arabic ? (
        <Panel data-testid="tc-arabic">
          <h3 className="font-display text-lg">{s.arTitle}</h3>
          <p className="text-ink-faint text-sm">{s.arBody}</p>
        </Panel>
      ) : null}

      <Panel>
        <h3 className="font-display text-lg">{s.ctxTitle}</h3>
        <Field label={s.ctxLabel}>
          <Input value={ctx} onChange={(e) => setCtx(e.target.value)} inputMode="numeric"
            data-testid="tc-context" />
        </Field>
        {tokens !== undefined && ctxN > 0 ? (
          <p data-testid="tc-used">
            {tokens > ctxN
              ? `${s.ctxOver} ${nf.format(tokens - ctxN)} ${s.tokens}`
              : `${nf.format(Number(((tokens / ctxN) * 100).toFixed(1)))}% ${s.ctxUsed} · ${nf.format(Math.floor(ctxN / Math.max(1, tokens)))} ${s.ctxFits}`}
          </p>
        ) : null}
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.priceTitle}</h3>
        <Field label={s.priceLabel}>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal"
            placeholder="0.00" data-testid="tc-price" />
        </Field>
        <p className="text-ink-faint text-sm">{s.priceHelp}</p>
        {cost !== null ? (
          <p data-testid="tc-cost">{s.cost}: {money.format(cost)}</p>
        ) : null}
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.priceWhyTitle}</h3>
        <p className="text-ink-faint text-sm" data-testid="tc-no-prices">{s.priceWhyBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.privTitle}</h3>
        <p className="text-ink-faint text-sm">{s.privBody}</p>
      </Panel>

      <p className="text-sm">
        <a href={localePath(locale, '/apps/text-counter')}>{s.related}</a>
      </p>
    </Stack>
  )
}
