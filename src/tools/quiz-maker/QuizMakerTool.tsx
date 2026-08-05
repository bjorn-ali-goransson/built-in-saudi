import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { DownloadIcon, CopyIcon, TrashIcon, CheckIcon } from '../../components/icons'
import { Button, Input, Textarea, Select, Field, Check, Stack, Panel, StackActions } from '../../components/ui'
import {
  LINK_LIMIT, answerText, blank, buildQuizPdf, decodeQuiz, encodeQuiz, isAnswered,
  type Kind, type Question, type Quiz,
} from './quiz'

const STR = {
  en: {
    title: 'Quiz title', titlePlaceholder: 'Chapter 3 review',
    add: 'Add question', remove: 'Remove',
    kind: 'Type', kinds: { mcq: 'Multiple choice', tf: 'True / false', short: 'Short answer' } as Record<Kind, string>,
    question: 'Question', questionPlaceholder: 'What is…',
    choice: 'Choice', correct: 'Correct',
    answer: 'Expected answer',
    tf: ['True', 'False'] as [string, string],
    withKey: 'Include an answer key page',
    download: 'Download PDF', working: 'Building…',
    share: 'Copy share link', copied: 'Copied!',
    shareWhy: 'The link carries the whole quiz after the # — a fragment is never sent to a server, so the quiz is not stored anywhere and there is nothing to sign in to. Anyone with the link can take it.',
    tooLong: 'This link is long enough that some chat apps will cut it. Shorten the questions, or hand out the PDF instead.',
    preview: 'Try it', play: 'Take the quiz', backToEdit: 'Back to editing',
    submit: 'Check answers', again: 'Try again',
    score: (a: number, b: number) => `${a} of ${b} correct`,
    yourAnswer: 'You put', correctIs: 'Correct answer',
    empty: 'No questions yet — add one.',
    incomplete: (n: number) => `${n} question${n === 1 ? ' is' : 's are'} unfinished and will be left out of the PDF and the link.`,
    editCopy: 'Edit a copy',
    takingTitle: 'Quiz',
    labelName: 'Name', labelDate: 'Date', labelScore: 'Score', labelKey: 'Answer key',
    of: (a: number, b: number) => `Page ${a} of ${b}`,
    unanswered: 'Answer every question first.',
  },
  ar: {
    title: 'عنوان الاختبار', titlePlaceholder: 'مراجعة الفصل الثالث',
    add: 'أضف سؤالًا', remove: 'حذف',
    kind: 'النوع', kinds: { mcq: 'اختيار من متعدد', tf: 'صح / خطأ', short: 'إجابة قصيرة' } as Record<Kind, string>,
    question: 'السؤال', questionPlaceholder: 'ما هو…',
    choice: 'خيار', correct: 'الصحيح',
    answer: 'الإجابة المتوقعة',
    tf: ['صح', 'خطأ'] as [string, string],
    withKey: 'أضف صفحة الإجابات',
    download: 'نزّل PDF', working: 'جارٍ التجهيز…',
    share: 'انسخ رابط المشاركة', copied: 'تم النسخ!',
    shareWhy: 'يحمل الرابط الاختبار كاملًا بعد علامة # — والجزء الذي بعدها لا يُرسل إلى أي خادم، فالاختبار غير مخزّن في أي مكان ولا حساب للدخول. ومن يملك الرابط يستطيع أداءه.',
    tooLong: 'هذا الرابط طويل بما يكفي لأن تقطعه بعض تطبيقات المحادثة. اختصر الأسئلة أو وزّع ملف PDF بدلًا منه.',
    preview: 'جرّبه', play: 'أدِّ الاختبار', backToEdit: 'عودة إلى التحرير',
    submit: 'تحقّق من الإجابات', again: 'حاول مجددًا',
    score: (a: number, b: number) => `${a} من ${b} صحيحة`,
    yourAnswer: 'إجابتك', correctIs: 'الإجابة الصحيحة',
    empty: 'لا أسئلة بعد — أضف سؤالًا.',
    incomplete: (n: number) => `${n} سؤالًا غير مكتمل وسيُستبعد من ملف PDF ومن الرابط.`,
    editCopy: 'حرّر نسخة',
    takingTitle: 'اختبار',
    labelName: 'الاسم', labelDate: 'التاريخ', labelScore: 'الدرجة', labelKey: 'الإجابات',
    of: (a: number, b: number) => `صفحة ${a} من ${b}`,
    unanswered: 'أجب عن كل الأسئلة أولًا.',
  },
}

function readHash(): Quiz | null {
  const m = /[#&]q=([^&]+)/.exec(window.location.hash)
  return m ? decodeQuiz(m[1]) : null
}

export default function QuizMakerTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [shared, setShared] = useState<Quiz | null>(() => readHash())
  const [quiz, setQuiz] = useState<Quiz>({ title: '', questions: [blank('mcq')] })
  const [taking, setTaking] = useState(false)
  const [withKey, setWithKey] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const on = () => setShared(readHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const ready = useMemo(() => quiz.questions.filter(isAnswered), [quiz])
  const incomplete = quiz.questions.length - ready.length
  const link = useMemo(
    () => `${window.location.origin}${window.location.pathname}#q=${encodeQuiz({ ...quiz, questions: ready })}`,
    [quiz, ready],
  )

  const setQ = (i: number, patch: Partial<Question>) =>
    setQuiz((p) => ({ ...p, questions: p.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) }))

  function changeKind(i: number, kind: Kind) {
    const base = blank(kind)
    setQ(i, { kind, choices: kind === 'mcq' ? (quiz.questions[i].choices.length ? quiz.questions[i].choices : base.choices) : [], correct: 0 })
  }

  async function download() {
    setBusy(true)
    try {
      const blob = await buildQuizPdf({ ...quiz, questions: ready }, {
        name: s.labelName, date: s.labelDate, score: s.labelScore, key: s.labelKey, tf: s.tf, of: s.of,
      }, withKey)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(quiz.title || 'quiz').replace(/[^\w؀-ۿ-]+/g, '-').slice(0, 40)}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setBusy(false) }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  // Someone opened a shared link: they take the quiz, they do not see the key.
  if (shared && !taking) {
    return (
      <Stack data-testid="quiz-maker">
        <Play quiz={shared} s={s} />
        <Button className="self-start" data-testid="qz-edit-copy" onClick={() => {
          setQuiz(shared)
          history.replaceState(null, '', window.location.pathname + window.location.search)
          setShared(null)
        }}>{s.editCopy}</Button>
      </Stack>
    )
  }

  if (taking) {
    return (
      <Stack data-testid="quiz-maker">
        <Button className="self-start" data-testid="qz-back" onClick={() => setTaking(false)}>{s.backToEdit}</Button>
        <Play quiz={{ ...quiz, questions: ready }} s={s} />
      </Stack>
    )
  }

  return (
    <Stack data-testid="quiz-maker">
      <Field label={s.title}>
        <Input value={quiz.title} placeholder={s.titlePlaceholder} data-testid="qz-title"
          onChange={(e) => setQuiz((p) => ({ ...p, title: e.target.value }))} />
      </Field>

      {quiz.questions.map((q, i) => (
        <Panel key={i} data-testid={`qz-q-${i}`} className="gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[0.85rem] text-ink-faint">{i + 1}</span>
            <Select value={q.kind} data-testid={`qz-kind-${i}`} className="w-auto"
              onChange={(e) => changeKind(i, e.target.value as Kind)}>
              {(['mcq', 'tf', 'short'] as Kind[]).map((k) => <option key={k} value={k}>{s.kinds[k]}</option>)}
            </Select>
            <Button className="ms-auto px-3 py-1" data-testid={`qz-remove-${i}`} aria-label={s.remove}
              onClick={() => setQuiz((p) => ({ ...p, questions: p.questions.filter((_, k) => k !== i) }))}>
              <TrashIcon />
            </Button>
          </div>

          <Textarea rows={2} value={q.q} placeholder={s.questionPlaceholder} data-testid={`qz-text-${i}`}
            onChange={(e) => setQ(i, { q: e.target.value })} />

          {q.kind === 'mcq' && (
            <div className="flex flex-col gap-2">
              {q.choices.map((c, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${i}`} checked={q.correct === k} data-testid={`qz-correct-${i}-${k}`}
                    aria-label={s.correct} className="accent-green-600 size-[1.05rem]"
                    onChange={() => setQ(i, { correct: k })} />
                  <Input value={c} data-testid={`qz-choice-${i}-${k}`} placeholder={`${s.choice} ${String.fromCharCode(65 + k)}`}
                    onChange={(e) => setQ(i, { choices: q.choices.map((x, j) => (j === k ? e.target.value : x)) })} />
                </div>
              ))}
            </div>
          )}

          {q.kind === 'tf' && (
            <div className="flex gap-4">
              {s.tf.map((label, k) => (
                <Check key={k}>
                  <input type="radio" name={`correct-${i}`} checked={q.correct === k} data-testid={`qz-correct-${i}-${k}`}
                    onChange={() => setQ(i, { correct: k })} /> {label}
                </Check>
              ))}
            </div>
          )}

          {q.kind === 'short' && (
            <Field label={s.answer}>
              <Input value={q.answer} data-testid={`qz-answer-${i}`}
                onChange={(e) => setQ(i, { answer: e.target.value })} />
            </Field>
          )}
        </Panel>
      ))}

      {!quiz.questions.length && <p className="text-ink-faint rtl:font-ar" data-testid="qz-empty">{s.empty}</p>}

      <StackActions>
        <Button onClick={() => setQuiz((p) => ({ ...p, questions: [...p.questions, blank('mcq')] }))} data-testid="qz-add">
          {s.add}
        </Button>
        <Button variant="primary" onClick={download} disabled={busy || !ready.length} data-testid="qz-download">
          <DownloadIcon /> {busy ? s.working : s.download}
        </Button>
        <Button onClick={copyLink} disabled={!ready.length} data-testid="qz-share">
          <CopyIcon /> {copied ? s.copied : s.share}
        </Button>
        <Button onClick={() => setTaking(true)} disabled={!ready.length} data-testid="qz-play">{s.preview}</Button>
      </StackActions>

      <Check><input type="checkbox" checked={withKey} data-testid="qz-with-key"
        onChange={(e) => setWithKey(e.target.checked)} /> {s.withKey}</Check>

      {incomplete > 0 && (
        <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="qz-incomplete">{s.incomplete(incomplete)}</p>
      )}

      <Panel className="gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.shareWhy}</p>
        {ready.length > 0 && link.length > LINK_LIMIT && (
          <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="qz-too-long">{s.tooLong}</p>
        )}
      </Panel>
    </Stack>
  )
}

type Strings = typeof STR['en']

function Play({ quiz, s }: { quiz: Quiz; s: Strings }) {
  const [picked, setPicked] = useState<Record<number, string>>({})
  const [marked, setMarked] = useState(false)

  const correctFor = (q: Question) => answerText(q, s.tf)
  const isRight = (q: Question, given: string | undefined) =>
    (given ?? '').trim().toLowerCase() === correctFor(q).trim().toLowerCase()
  const score = quiz.questions.filter((q, i) => isRight(q, picked[i])).length
  const allAnswered = quiz.questions.every((_, i) => (picked[i] ?? '').trim())

  return (
    <Stack data-testid="qz-play-view">
      {quiz.title && <h2 className="font-display text-[1.4rem] text-ink">{quiz.title}</h2>}
      {quiz.questions.map((q, i) => {
        const right = isRight(q, picked[i])
        return (
          <Panel key={i} data-testid={`qz-play-q-${i}`}
            className={`gap-2 ${marked ? (right ? 'border-green-600' : 'border-gold-400') : ''}`}>
            <p className="text-ink font-medium rtl:font-ar"><span className="text-ink-faint me-2">{i + 1}.</span>{q.q}</p>
            {q.kind === 'short' ? (
              <Input value={picked[i] ?? ''} disabled={marked} data-testid={`qz-play-input-${i}`}
                onChange={(e) => setPicked((p) => ({ ...p, [i]: e.target.value }))} />
            ) : (
              <div className="flex flex-col gap-1.5">
                {(q.kind === 'tf' ? s.tf : q.choices.filter((c) => c.trim())).map((c, k) => (
                  <Check key={k}>
                    <input type="radio" name={`play-${i}`} disabled={marked} checked={picked[i] === c}
                      data-testid={`qz-play-choice-${i}-${k}`}
                      onChange={() => setPicked((p) => ({ ...p, [i]: c }))} /> {c}
                  </Check>
                ))}
              </div>
            )}
            {marked && (
              <p className={`text-[0.88rem] ${right ? 'text-green-700' : 'text-gold-500'}`} data-testid={`qz-result-${i}`}>
                {right ? <><CheckIcon /> {correctFor(q)}</> : `${s.correctIs}: ${correctFor(q)}`}
              </p>
            )}
          </Panel>
        )
      })}
      {!marked ? (
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="primary" onClick={() => setMarked(true)} disabled={!allAnswered} data-testid="qz-submit">
            {s.submit}
          </Button>
          {!allAnswered && <span className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.unanswered}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[1.1rem] font-semibold text-ink" data-testid="qz-score">{s.score(score, quiz.questions.length)}</span>
          <Button onClick={() => { setMarked(false); setPicked({}) }} data-testid="qz-again">{s.again}</Button>
        </div>
      )}
    </Stack>
  )
}
