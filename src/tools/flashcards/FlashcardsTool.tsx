import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Button, Input, Field, Seg, SegButton } from '../../components/ui'
import { TrashIcon } from '../../components/icons'

const KEY = 'bis-flashcards'
type Card = { id: string; front: string; back: string }

const STR = {
  en: { edit: 'Edit deck', study: 'Study', front: 'Front (prompt)', back: 'Back (answer)', add: 'Add card', cards: 'cards', empty: 'No cards yet — add a few to start studying.', flip: 'Flip', prev: 'Previous', next: 'Next', shuffle: 'Shuffle', of: 'of', tapHint: 'Tap the card to flip', privacy: 'Saved in this browser — nothing is uploaded.' },
  ar: { edit: 'تحرير المجموعة', study: 'مذاكرة', front: 'الوجه (السؤال)', back: 'الظهر (الإجابة)', add: 'أضِف بطاقة', cards: 'بطاقة', empty: 'لا بطاقات بعد — أضِف بعضها لتبدأ المذاكرة.', flip: 'اقلب', prev: 'السابقة', next: 'التالية', shuffle: 'اخلط', of: 'من', tapHint: 'اضغط البطاقة لقلبها', privacy: 'محفوظة في هذا المتصفح — لا يُرفع أي شيء.' },
}

const rid = () => Math.random().toString(36).slice(2, 9)

export default function FlashcardsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [cards, setCards] = useState<Card[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } })
  const [mode, setMode] = useState<'edit' | 'study'>('edit')
  const [front, setFront] = useState(''); const [back, setBack] = useState('')
  const [order, setOrder] = useState<number[]>([])
  const [pos, setPos] = useState(0); const [flipped, setFlipped] = useState(false)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(cards)) } catch { /* */ } }, [cards])

  function add() { if (!front.trim() && !back.trim()) return; setCards((c) => [...c, { id: rid(), front: front.trim(), back: back.trim() }]); setFront(''); setBack('') }
  function startStudy() { setOrder(cards.map((_, i) => i)); setPos(0); setFlipped(false); setMode('study') }
  function shuffle() { setOrder((o) => { const r = [...o]; const rand = crypto.getRandomValues(new Uint32Array(r.length)); for (let i = r.length - 1; i > 0; i--) { const j = rand[i] % (i + 1);[r[i], r[j]] = [r[j], r[i]] } return r }); setPos(0); setFlipped(false) }

  const card = mode === 'study' && order.length ? cards[order[pos]] : null

  return (
    <Stack data-testid="flashcards">
      <Seg className="self-start">
        <SegButton active={mode === 'edit'} onClick={() => setMode('edit')} data-testid="fc-edit">{s.edit}</SegButton>
        <SegButton active={mode === 'study'} onClick={startStudy} data-testid="fc-study" >{s.study} ({cards.length})</SegButton>
      </Seg>

      {mode === 'edit' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={s.front}><Input value={front} onChange={(e) => setFront(e.target.value)} data-testid="fc-front" /></Field>
            <Field label={s.back}><Input value={back} onChange={(e) => setBack(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} data-testid="fc-back" /></Field>
          </div>
          <Button variant="primary" onClick={add} className="self-start" data-testid="fc-add">{s.add}</Button>
          <p className="text-[0.82rem] text-ink-faint">{cards.length} {s.cards}</p>
          <div className="flex flex-col gap-2">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center gap-2 border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-2 text-[0.9rem]">
                <span className="flex-1 truncate"><b className="text-ink">{c.front}</b> <span className="text-ink-faint">— {c.back}</span></span>
                <Button onClick={() => setCards((cur) => cur.filter((x) => x.id !== c.id))} aria-label="delete"><TrashIcon className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        </>
      ) : !card ? (
        <p className="text-[0.95rem] text-ink-soft" data-testid="fc-empty">{s.empty}</p>
      ) : (
        <>
          <button type="button" onClick={() => setFlipped((f) => !f)} data-testid="fc-card"
            className="w-full min-h-[220px] rounded-lg border border-[color:var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)] flex flex-col items-center justify-center gap-2 p-6 text-center cursor-pointer hover:border-green-500/40">
            <span className="text-[0.72rem] uppercase tracking-wide text-ink-faint">{flipped ? s.back : s.front}</span>
            <span className="text-[1.4rem] font-display text-ink" data-testid="fc-face">{flipped ? card.back : card.front}</span>
            <span className="text-[0.75rem] text-ink-faint mt-2">{s.tapHint}</span>
          </button>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button onClick={() => { setPos((p) => (p - 1 + order.length) % order.length); setFlipped(false) }} data-testid="fc-prev">← {s.prev}</Button>
            <span className="font-mono text-[0.9rem] text-ink-soft">{pos + 1} {s.of} {order.length}</span>
            <Button onClick={() => { setPos((p) => (p + 1) % order.length); setFlipped(false) }} data-testid="fc-next">{s.next} →</Button>
            <Button onClick={shuffle}>{s.shuffle}</Button>
          </div>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
