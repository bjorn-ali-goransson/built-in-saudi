import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button } from '../../components/ui'
import { DownloadIcon, TrashIcon } from '../../components/icons'

const KEY = 'bis-writer'
const STR = {
  en: { placeholder: 'Start writing…', words: 'words', chars: 'chars', read: 'min read', saved: 'Saved', txt: 'Download .txt', md: 'Download .md', clear: 'Clear', focus: 'Focus', exit: 'Exit focus', privacy: 'Autosaved in this browser — nothing is uploaded.' },
  ar: { placeholder: 'ابدأ الكتابة…', words: 'كلمة', chars: 'حرف', read: 'دقيقة قراءة', saved: 'محفوظ', txt: 'تنزيل .txt', md: 'تنزيل .md', clear: 'مسح', focus: 'تركيز', exit: 'إنهاء التركيز', privacy: 'يُحفظ تلقائيًا في هذا المتصفح — لا يُرفع أي شيء.' },
}

export default function WriterTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState(() => { try { return localStorage.getItem(KEY) || '' } catch { return '' } })
  const [focus, setFocus] = useState(false)
  const saveTimer = useRef<number | undefined>(undefined)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { try { localStorage.setItem(KEY, text); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1000) } catch { /* */ } }, 500)
    return () => window.clearTimeout(saveTimer.current)
  }, [text])

  const stats = useMemo(() => {
    const words = (text.trim().match(/\S+/g) || []).length
    return { words, chars: text.length, read: Math.max(1, Math.round(words / 200)) }
  }, [text])

  function download(ext: string) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = `writing.${ext}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className={`flex flex-col gap-3 ${focus ? 'fixed inset-0 z-[70] bg-[var(--paper)] p-[clamp(1rem,5vw,3rem)]' : ''}`} data-testid="writer">
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={s.placeholder} autoFocus data-testid="wr-input"
        className={`w-full rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-4 text-[1.05rem] leading-relaxed focus:outline-none focus:border-green-500 resize-none ${focus ? 'flex-1 text-[1.15rem] max-w-[52rem] mx-auto w-full' : 'min-h-[52vh]'}`} />
      <div className={`flex items-center gap-3 flex-wrap text-[0.85rem] text-ink-soft ${focus ? 'max-w-[52rem] mx-auto w-full' : ''}`}>
        <span data-testid="wr-words"><b className="text-ink font-mono">{stats.words}</b> {s.words}</span>
        <span><b className="text-ink font-mono">{stats.chars}</b> {s.chars}</span>
        <span><b className="text-ink font-mono">{stats.read}</b> {s.read}</span>
        {savedFlash && <span className="text-green-600">· {s.saved}</span>}
        <span className="flex-1" />
        <Button onClick={() => setFocus((f) => !f)}>{focus ? s.exit : s.focus}</Button>
        <Button onClick={() => download('txt')}><DownloadIcon /> {s.txt}</Button>
        <Button onClick={() => download('md')}><DownloadIcon /> {s.md}</Button>
        <Button onClick={() => { if (confirm('Clear all text?')) setText('') }}><TrashIcon className="w-4 h-4" /> {s.clear}</Button>
      </div>
      {!focus && <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>}
    </div>
  )
}
