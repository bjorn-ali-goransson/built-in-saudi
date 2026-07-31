import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Button, Textarea, Field } from '../../components/ui'
import { loadGis, GOOGLE_CLIENT_ID } from '../../lib/cvApi'

const FN = 'https://us-central1-blitz-ksa.cloudfunctions.net'

const DIMS = [
  { key: 'purpose_coherence', short: 'Purpose', full: 'Purpose coherence' },
  { key: 'context_instruction_harmony', short: 'Harmony', full: 'Context–instruction harmony' },
  { key: 'even_signal', short: 'Even signal', full: 'Even signal (low spikiness)' },
  { key: 'calm_tone', short: 'Calm tone', full: 'Calm tone (low shoutiness)' },
  { key: 'non_contradictory', short: 'Consistent', full: 'Non-contradictory' },
  { key: 'positive_framing', short: 'Positive', full: 'Positive framing' },
  { key: 'escape_hatch', short: 'Escape hatch', full: 'Escape hatch' },
  { key: 'stakes_clarity', short: 'Stakes', full: 'Stakes clarity' },
] as const

interface Gap { id: string; question: string; why: string }
interface Result { scores: Record<string, number>; issues: { headline: string; description: string }[]; gaps?: Gap[]; summary: string }

// Score → heatmap colour: 1 = red, 3 = amber, 5 = green (hue 0°→120° via 60°).
function heat(v: number, s = 68, l = 45): string {
  const hue = (Math.max(1, Math.min(5, v || 1)) - 1) / 4 * 120
  return `hsl(${hue} ${s}% ${l}%)`
}

const STR = {
  en: {
    lead: 'Paste an LLM system prompt and one AI pass grades it — for spikiness, context-vs-instruction harmony, contradictions, shoutiness and more — as a spider chart, with the issues listed out. Three analyses per 24 hours.',
    placeholder: 'Paste your system prompt here…', signin: 'Sign in to analyse', analyse: 'Analyse prompt', working: 'Analysing…',
    signinNote: 'Free — signing in just keeps the AI budget fair (three runs per 24h).', overall: 'Overall', issues: 'Issues', again: 'Analyse another',
    scale: '1 = poor · 5 = healthy', privacy: 'Your prompt is sent to the AI for this analysis and not stored.',
    heatLow: 'weak', heatHigh: 'strong',
    improveTitle: 'Get an improved prompt', improveLead: 'Fill in what only you can answer — leave any blank — and the AI rewrites your prompt to close the gaps. This is the second pass.',
    suggest: 'Suggest a better prompt', generate: 'Rewrite my prompt', generating: 'Rewriting…', optional: 'optional',
    improvedTitle: 'Improved prompt', copy: 'Copy', copied: 'Copied', useIt: 'Use as new input',
  },
  ar: {
    lead: 'الصق موجّه نظام لنموذج لغوي، وتقيّمه الأداة بمرور واحد للذكاء الاصطناعي — للحدّة، وتناغم السياق مع التعليمات، والتناقضات، والصياح وغيرها — كمخطط عنكبوتي، مع سرد المشكلات. ثلاثة تحاليل كل ٢٤ ساعة.',
    placeholder: 'الصق موجّه النظام هنا…', signin: 'سجّل الدخول للتحليل', analyse: 'حلّل الموجّه', working: 'جارٍ التحليل…',
    signinNote: 'مجاني — تسجيل الدخول فقط لضبط ميزانية الذكاء الاصطناعي (ثلاث مرات كل ٢٤ ساعة).', overall: 'الإجمالي', issues: 'المشكلات', again: 'حلّل آخر',
    scale: '١ = ضعيف · ٥ = سليم', privacy: 'يُرسل موجّهك للذكاء الاصطناعي لهذا التحليل ولا يُخزَّن.',
    heatLow: 'ضعيف', heatHigh: 'قوي',
    improveTitle: 'احصل على موجّه أفضل', improveLead: 'أجب عمّا لا يعرفه سواك — واترك ما شئت فارغًا — فيعيد الذكاء الاصطناعي صياغة موجّهك ليسدّ الثغرات. هذا هو المرور الثاني.',
    suggest: 'اقترح موجّهًا أفضل', generate: 'أعد صياغة موجّهي', generating: 'جارٍ إعادة الصياغة…', optional: 'اختياري',
    improvedTitle: 'الموجّه المحسّن', copy: 'نسخ', copied: 'تم النسخ', useIt: 'استخدمه كمدخل جديد',
  },
}

function Radar({ scores }: { scores: Record<string, number> }) {
  const N = DIMS.length, cx = 200, cy = 200, R = 135
  const ang = (i: number) => ((-90 + (i * 360) / N) * Math.PI) / 180
  const pt = (i: number, r: number): [number, number] => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]
  const ring = (v: number) => DIMS.map((_, i) => pt(i, (R * v) / 5).join(',')).join(' ')
  const val = (i: number) => scores[DIMS[i].key] || 0
  const vpt = (i: number) => pt(i, (R * val(i)) / 5)
  const poly = DIMS.map((_, i) => vpt(i).join(',')).join(' ')
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-[420px] mx-auto" role="img" aria-label="Prompt scores">
      {[1, 2, 3, 4, 5].map((v) => <polygon key={v} points={ring(v)} fill="none" stroke="color-mix(in srgb, var(--ink) 12%, transparent)" strokeWidth={1} />)}
      {DIMS.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="color-mix(in srgb, var(--ink) 8%, transparent)" /> })}
      {/* Heatmap fill: each sector is a triangle from centre to two adjacent
          data points, coloured by the mean of the two scores (red→amber→green). */}
      {DIMS.map((_, i) => {
        const j = (i + 1) % N
        const [x1, y1] = vpt(i), [x2, y2] = vpt(j)
        return <polygon key={`s${i}`} points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`} fill={heat((val(i) + val(j)) / 2)} fillOpacity={0.5} stroke="none" />
      })}
      <polygon points={poly} fill="none" stroke="color-mix(in srgb, var(--ink) 45%, transparent)" strokeWidth={1.5} strokeLinejoin="round" />
      {DIMS.map((d, i) => { const [x, y] = vpt(i); return <circle key={d.key} cx={x} cy={y} r={3.5} fill={heat(val(i), 70, 38)} stroke="var(--paper)" strokeWidth={1} /> })}
      {DIMS.map((d, i) => { const [x, y] = pt(i, R + 22); return <text key={d.key} x={x} y={y} fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="middle" fill="var(--ink-soft)">{d.short}</text> })}
    </svg>
  )
}

export default function PromptAnalyzerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [idToken, setIdToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const btnRef = useRef<HTMLDivElement>(null)
  const pending = useRef(false)

  // Second pass: the gaps form + the rewritten prompt.
  const [showForm, setShowForm] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [improving, setImproving] = useState(false)
  const [improveErr, setImproveErr] = useState('')
  const [improved, setImproved] = useState<{ improved: string; notes: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let stop = false
    loadGis().then((gis) => {
      if (stop) return
      gis.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r: { credential: string }) => { setIdToken(r.credential); if (pending.current) { pending.current = false; run(r.credential) } } })
      if (btnRef.current) gis.renderButton(btnRef.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill' })
    }).catch(() => { /* offline */ })
    return () => { stop = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetImprove() { setShowForm(false); setAnswers({}); setImproving(false); setImproveErr(''); setImproved(null); setCopied(false) }

  async function run(token: string) {
    setBusy(true); setErr(''); setResult(null); resetImprove()
    try {
      const r = await fetch(`${FN}/analyze-prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token, prompt: text }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setResult(d)
    } catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }
  function analyse() {
    if (text.trim().length < 20) { setErr(locale === 'ar' ? 'الصق موجّهًا أطول.' : 'Paste a longer prompt.'); return }
    if (idToken) run(idToken)
    else { pending.current = true; loadGis().then((gis) => gis.prompt()).catch(() => { /* use the button */ }) }
  }

  async function improve() {
    if (!idToken || !result) return
    setImproving(true); setImproveErr(''); setImproved(null); setCopied(false)
    try {
      const gaps = result.gaps || []
      const payload = gaps.map((g) => ({ question: g.question, answer: answers[g.id] || '' }))
      const r = await fetch(`${FN}/improve-prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, prompt: text, answers: payload }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setImproved({ improved: d.improved, notes: d.notes || '' })
    } catch (e) { setImproveErr((e as Error).message) }
    finally { setImproving(false) }
  }

  async function copyImproved() {
    if (!improved) return
    try { await navigator.clipboard.writeText(improved.improved); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* clipboard blocked */ }
  }
  function reuse() {
    if (!improved) return
    setText(improved.improved); setResult(null); setErr(''); resetImprove()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const overall = result ? Math.round((DIMS.reduce((a, d) => a + (result.scores[d.key] || 0), 0) / DIMS.length) * 10) / 10 : 0
  const gaps = result?.gaps || []

  return (
    <Stack data-testid="prompt-analyzer">
      {!result && (
        <>
          <p className="text-[0.95rem] text-ink-soft leading-relaxed">{s.lead}</p>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={s.placeholder} className="min-h-[38vh] resize-y font-mono text-[0.88rem]" data-testid="pa-input" />
          {err && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="pa-err">{err}</p>}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="primary" disabled={busy} onClick={analyse} data-testid="pa-run">{busy ? s.working : (idToken ? s.analyse : s.signin)}</Button>
            {!idToken && <div ref={btnRef} className="[color-scheme:light]" />}
          </div>
          {!idToken && <p className="text-[0.8rem] text-ink-faint">{s.signinNote}</p>}
        </>
      )}

      {result && (
        <div className="flex flex-col gap-5" data-testid="pa-result">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 min-w-0">
              <Radar scores={result.scores} />
              <div className="flex items-center justify-center gap-2 text-[0.72rem] text-ink-faint mt-1">
                <span>{s.heatLow}</span>
                <span className="h-2.5 w-28 rounded-[2px]" style={{ background: `linear-gradient(to right, ${heat(1)}, ${heat(3)}, ${heat(5)})` }} aria-hidden="true" />
                <span>{s.heatHigh}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-[15rem]">
              <div className="flex items-baseline gap-2"><span className="text-[2.4rem] font-display font-bold leading-none" style={{ color: heat(overall, 70, 38) }}>{overall}</span><span className="text-ink-faint text-[0.9rem]">/ 5 · {s.overall}</span></div>
              <p className="text-[0.72rem] text-ink-faint">{s.scale}</p>
              <ul className="flex flex-col gap-1 mt-1">
                {DIMS.map((d) => { const v = result.scores[d.key] || 0; return (
                  <li key={d.key} className="flex items-center gap-2 text-[0.82rem]">
                    <span className="flex-1 text-ink-soft truncate">{d.full}</span>
                    <span className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <span key={n} className="w-1.5 h-3.5 rounded-[1px]" style={{ background: n <= v ? heat(v) : 'color-mix(in srgb, var(--ink) 10%, transparent)' }} />)}</span>
                  </li>) })}
              </ul>
            </div>
          </div>
          {result.summary && <p className="text-[0.95rem] text-ink leading-relaxed border-s-[3px] border-green-500 ps-3">{result.summary}</p>}
          <div className="flex flex-col gap-3">
            <h2 className="text-[1.05rem] font-semibold text-ink">{s.issues} · {result.issues.length}</h2>
            {result.issues.map((i, n) => (
              <div key={n} className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3">
                <div className="flex items-start gap-2"><span className="text-gold-500 font-bold flex-none">{n + 1}.</span><div><p className="font-semibold text-ink text-[0.95rem]">{i.headline}</p><p className="text-[0.9rem] text-ink-soft leading-relaxed mt-0.5">{i.description}</p></div></div>
              </div>
            ))}
          </div>

          {/* Second pass: fill the gaps, then rewrite. */}
          {!improved && (
            <div className="flex flex-col gap-3 border-t border-[color:var(--line-soft)] pt-4" data-testid="pa-improve">
              <div>
                <h2 className="text-[1.05rem] font-semibold text-ink">{s.improveTitle}</h2>
                <p className="text-[0.9rem] text-ink-soft leading-relaxed mt-0.5">{s.improveLead}</p>
              </div>
              {!showForm && (
                <Button variant="primary" className="self-start" onClick={() => (gaps.length ? setShowForm(true) : improve())} data-testid="pa-suggest">{s.suggest}</Button>
              )}
              {showForm && (
                <div className="flex flex-col gap-3">
                  {gaps.map((g) => (
                    <Field key={g.id} label={<span>{g.question} {g.why && <span className="text-ink-faint font-normal">· {g.why}</span>} <span className="text-ink-faint font-normal">({s.optional})</span></span>}>
                      <Textarea value={answers[g.id] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [g.id]: e.target.value }))} className="min-h-[4.5rem] resize-y text-[0.9rem]" data-testid={`pa-gap-${g.id}`} />
                    </Field>
                  ))}
                  {improveErr && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="pa-improve-err">{improveErr}</p>}
                  <Button variant="primary" className="self-start" disabled={improving} onClick={improve} data-testid="pa-generate">{improving ? s.generating : s.generate}</Button>
                </div>
              )}
              {!showForm && improveErr && <p className="text-[color:var(--danger)] text-[0.9rem]" data-testid="pa-improve-err">{improveErr}</p>}
              {!showForm && improving && <p className="text-[0.9rem] text-ink-soft">{s.generating}</p>}
            </div>
          )}

          {improved && (
            <div className="flex flex-col gap-2 border-t border-[color:var(--line-soft)] pt-4" data-testid="pa-improved">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-[1.05rem] font-semibold text-ink">{s.improvedTitle}</h2>
                <Button className="text-[0.8rem] py-1 px-2.5" onClick={copyImproved} data-testid="pa-copy">{copied ? s.copied : s.copy}</Button>
                <Button className="text-[0.8rem] py-1 px-2.5" onClick={reuse} data-testid="pa-reuse">{s.useIt}</Button>
              </div>
              {improved.notes && <p className="text-[0.85rem] text-ink-faint">{improved.notes}</p>}
              <pre className="whitespace-pre-wrap font-mono text-[0.85rem] text-ink leading-relaxed border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-3 max-h-[50vh] overflow-auto" data-testid="pa-improved-text">{improved.improved}</pre>
            </div>
          )}

          <Button className="self-start" onClick={() => { setResult(null); setErr(''); resetImprove() }}>{s.again}</Button>
        </div>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
