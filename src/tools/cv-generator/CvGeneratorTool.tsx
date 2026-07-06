import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLocale } from '../../i18n'
import { Button, Panel, Stack, Input } from '../../components/ui'
import { DownloadIcon } from '../../components/icons'
import { loadGis, GOOGLE_CLIENT_ID, decodeJwt, generateCv, refineCv } from '../../lib/cvApi'
import { renderCvHtml, renderCvWordBlob } from './template'
import { cvFilename, type Cv } from './schema'

const STR = {
  en: {
    intro: 'Rebuild your CV for the 10-second recruiter scan — signal only, no noise. Upload your current CV; we rewrite it into a clean, ATS-ready template.',
    why: 'The purpose of a CV is not to get the job — it’s to get the interview. We strip the noise (photos, colours, GPAs, references, exact address, month-level dates) and keep only what earns a second look.',
    signin: 'Sign in with Google to continue',
    signinNote: 'Sign-in keeps this free tool from being abused. We only read your name and email — nothing is posted anywhere.',
    signedInAs: (e: string) => `Signed in as ${e}`,
    upload: 'Upload your CV',
    uploadHint: 'PDF, Word (.docx) or plain text. It’s read in your browser — only the extracted text is sent for rewriting.',
    choose: 'Choose file',
    extracting: 'Reading your CV…',
    extracted: (n: number) => `Extracted ${n.toLocaleString()} characters.`,
    tooShort: 'Couldn’t read enough text from that file. Try a text-based PDF or a .docx.',
    extractErr: 'Couldn’t read that file. Try a PDF, .docx or .txt.',
    generate: 'Generate my CV',
    generating: 'Rewriting your CV…',
    genErr: 'Generation failed. Please try again.',
    result: 'Your rebuilt CV',
    pdf: 'Save as PDF',
    word: 'Download Word',
    again: 'Regenerate',
    newFile: 'Start over',
    signinErr: 'Google sign-in couldn’t load. Disable blockers and retry.',
    refineTitle: 'Fine-tune',
    refinePh: 'e.g. Make the summary shorter · Emphasise leadership · Drop the oldest role',
    apply: 'Apply',
    applying: 'Applying…',
    tweaksLeft: (n: number) => `${n} tweak${n === 1 ? '' : 's'} left`,
    noTweaks: 'No tweaks left for this CV — upload again to start fresh.',
    limitNote: '2 CVs per 24 hours · 3 tweaks each.',
  },
  ar: {
    intro: 'أعِد بناء سيرتك لمسح المجنِّد الذي يستغرق ١٠ ثوانٍ — إشارة فقط بلا ضجيج. ارفع سيرتك الحالية ونعيد كتابتها في قالب نظيف متوافق مع أنظمة التتبّع.',
    why: 'هدف السيرة ليس الحصول على الوظيفة — بل الحصول على المقابلة. نزيل الضجيج (الصور والألوان والمعدّلات والمراجع والعنوان الدقيق وتواريخ الأشهر) ونُبقي ما يستحق نظرة ثانية.',
    signin: 'سجّل الدخول بجوجل للمتابعة',
    signinNote: 'تسجيل الدخول يمنع إساءة استخدام هذه الأداة المجانية. نقرأ اسمك وبريدك فقط، ولا يُنشر أي شيء.',
    signedInAs: (e: string) => `مسجّل باسم ${e}`,
    upload: 'ارفع سيرتك الذاتية',
    uploadHint: 'PDF أو Word‏ (.docx) أو نص. تُقرأ داخل متصفحك — ويُرسَل النص المستخرج فقط لإعادة الكتابة.',
    choose: 'اختر ملفًا',
    extracting: 'جارٍ قراءة سيرتك…',
    extracted: (n: number) => `استُخرج ${n.toLocaleString()} حرفًا.`,
    tooShort: 'تعذّرت قراءة نص كافٍ من الملف. جرّب PDF نصيًا أو .docx.',
    extractErr: 'تعذّرت قراءة الملف. جرّب PDF أو .docx أو .txt.',
    generate: 'أنشئ سيرتي',
    generating: 'جارٍ إعادة كتابة سيرتك…',
    genErr: 'فشل الإنشاء. حاول مرة أخرى.',
    result: 'سيرتك بعد إعادة البناء',
    pdf: 'حفظ PDF',
    word: 'تنزيل Word',
    again: 'إعادة الإنشاء',
    newFile: 'ابدأ من جديد',
    signinErr: 'تعذّر تحميل تسجيل دخول جوجل. عطّل المانعات وأعد المحاولة.',
    refineTitle: 'ضبط دقيق',
    refinePh: 'مثال: اجعل الملخّص أقصر · أبرِز القيادة · احذف أقدم وظيفة',
    apply: 'تطبيق',
    applying: 'جارٍ التطبيق…',
    tweaksLeft: (n: number) => `${n === 1 ? 'تعديل واحد متبقٍّ' : `${n} تعديلات متبقّية`}`,
    noTweaks: 'لا تعديلات متبقّية لهذه السيرة — ارفع من جديد للبدء من الصفر.',
    limitNote: 'سيرتان كل ٢٤ ساعة · ٣ تعديلات لكلٍّ.',
  },
}

type Status = 'idle' | 'extracting' | 'ready' | 'generating' | 'done' | 'error'

export default function CvGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [idToken, setIdToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [fileName, setFileName] = useState('')
  const [text, setText] = useState('')
  const [cv, setCv] = useState<Cv | null>(null)
  const [err, setErr] = useState('')
  const [refinesLeft, setRefinesLeft] = useState(0)
  const [instruction, setInstruction] = useState('')
  const [refining, setRefining] = useState(false)
  const btnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadGis()
      .then((id) => {
        if (cancelled) return
        id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (r) => {
            setIdToken(r.credential)
            setEmail(decodeJwt(r.credential).email || '')
          },
        })
        if (btnRef.current) id.renderButton(btnRef.current, { theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill' })
      })
      .catch(() => setErr(s.signinErr))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFileName(f.name)
    setErr('')
    setCv(null)
    setStatus('extracting')
    try {
      const { extractText } = await import('./extract')
      const t = await extractText(f)
      if (!t || t.length < 60) {
        setErr(s.tooShort)
        setStatus('idle')
        return
      }
      setText(t)
      setStatus('ready')
    } catch {
      setErr(s.extractErr)
      setStatus('idle')
    }
  }

  async function generate() {
    if (!idToken || !text) return
    setStatus('generating')
    setErr('')
    try {
      const { cv: result, refinesLeft: left } = await generateCv(idToken, text)
      setCv(result)
      setRefinesLeft(left)
      setInstruction('')
      setStatus('done')
    } catch (e) {
      setErr((e as Error).message || s.genErr)
      setStatus('ready')
    }
  }

  async function refine() {
    if (!idToken || !cv || !instruction.trim() || refinesLeft <= 0 || refining) return
    setRefining(true)
    setErr('')
    try {
      const { cv: result, refinesLeft: left } = await refineCv(idToken, cv, instruction.trim())
      setCv(result)
      setRefinesLeft(left)
      setInstruction('')
    } catch (e) {
      setErr((e as Error).message || s.genErr)
    } finally {
      setRefining(false)
    }
  }

  function exportPdf() {
    if (!cv) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(renderCvHtml(cv))
    w.document.title = cvFilename(cv)
    w.document.close()
    setTimeout(() => {
      w.focus()
      w.print()
    }, 500)
  }

  function exportWord() {
    if (!cv) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(renderCvWordBlob(cv))
    a.download = `${cvFilename(cv)}.doc`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <Stack data-testid="cv-generator">
      <p className="text-[0.95rem] text-ink-soft">{s.intro}</p>

      {!idToken ? (
        <Panel>
          <span className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]">{s.signin}</span>
          <div ref={btnRef} className="[color-scheme:light]" data-testid="google-signin" />
          <p className="text-[0.82rem] text-ink-faint">{s.signinNote}</p>
          {err && <p className="text-[0.85rem] text-gold-500">{err}</p>}
        </Panel>
      ) : (
        <>
          <p className="text-[0.82rem] text-ink-faint">{s.signedInAs(email)}</p>

          <Panel>
            <span className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]">{s.upload}</span>
            <p className="text-[0.82rem] text-ink-faint">{s.uploadHint} {s.limitNote}</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex">
                <input type="file" accept=".pdf,.docx,.txt,.md,text/plain,application/pdf" className="sr-only" onChange={onFile} data-testid="cv-file" />
                <span className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-4 py-2 text-[0.9rem] font-semibold text-ink-soft hover:border-green-600 hover:text-green-700">
                  {s.choose}
                </span>
              </label>
              {fileName && <span className="text-[0.85rem] text-ink-faint font-mono truncate max-w-[16rem]">{fileName}</span>}
            </div>
            {status === 'extracting' && <p className="text-[0.85rem] text-ink-faint">{s.extracting}</p>}
            {(status === 'ready' || status === 'generating' || status === 'done') && text && (
              <p className="text-[0.85rem] text-green-700">{s.extracted(text.length)}</p>
            )}
            {err && <p className="text-[0.85rem] text-gold-500">{err}</p>}
            {(status === 'ready' || status === 'generating' || status === 'done') && (
              <Button variant="primary" className="self-start" onClick={generate} disabled={status === 'generating'} data-testid="cv-generate">
                {status === 'generating' ? s.generating : status === 'done' ? s.again : s.generate}
              </Button>
            )}
          </Panel>

          {cv && status === 'done' && (
            <Panel data-testid="cv-result">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]">{s.result}</span>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={exportPdf} data-testid="cv-pdf"><DownloadIcon /> {s.pdf}</Button>
                  <Button onClick={exportWord} data-testid="cv-word"><DownloadIcon /> {s.word}</Button>
                </div>
              </div>

              {/* Fine-tune loop — up to 3 instruction tweaks, preview updates live */}
              <div className="flex flex-col gap-2 border-t border-[color:var(--line-soft)] pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.82rem] font-semibold text-ink-soft">{s.refineTitle}</span>
                  {refinesLeft > 0 && <span className="text-[0.78rem] text-ink-faint">{s.tweaksLeft(refinesLeft)}</span>}
                </div>
                {refinesLeft > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="grow min-w-0"
                      value={instruction}
                      placeholder={s.refinePh}
                      data-testid="cv-instruction"
                      onChange={(e) => setInstruction(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') refine() }}
                    />
                    <Button variant="primary" onClick={refine} disabled={refining || !instruction.trim()} data-testid="cv-refine">
                      {refining ? s.applying : s.apply}
                    </Button>
                  </div>
                ) : (
                  <p className="text-[0.82rem] text-ink-faint">{s.noTweaks}</p>
                )}
              </div>

              <iframe
                title={s.result}
                className="w-full h-[75vh] rounded-md border border-[color:var(--line-soft)] bg-white"
                srcDoc={renderCvHtml(cv)}
              />
              <p className="text-[0.8rem] text-ink-faint">{s.pdf}: {cvFilename(cv)}.pdf</p>
            </Panel>
          )}

          <p className="text-[0.82rem] text-ink-faint">{s.why}</p>
        </>
      )}
    </Stack>
  )
}
