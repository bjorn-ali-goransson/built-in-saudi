import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, Button } from '../../components/ui'
import { TrashIcon } from '../../components/icons'

const KEY = 'bis-kanban'
type Card = { id: string; text: string }
type Board = { todo: Card[]; doing: Card[]; done: Card[] }
type Col = keyof Board
const COLS: Col[] = ['todo', 'doing', 'done']
const rid = () => Math.random().toString(36).slice(2, 9)

const STR = {
  en: { todo: 'To-do', doing: 'Doing', done: 'Done', add: 'Add…', privacy: 'Saved in this browser — nothing is uploaded.' },
  ar: { todo: 'للعمل', doing: 'قيد التنفيذ', done: 'منجز', add: 'أضِف…', privacy: 'تُحفظ في هذا المتصفح — لا يُرفع أي شيء.' },
}

export default function KanbanTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [board, setBoard] = useState<Board>(() => { try { return { todo: [], doing: [], done: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { todo: [], doing: [], done: [] } } })
  const [drafts, setDrafts] = useState<Record<Col, string>>({ todo: '', doing: '', done: '' })

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(board)) } catch { /* */ } }, [board])

  function add(col: Col) { const t = drafts[col].trim(); if (!t) return; setBoard((b) => ({ ...b, [col]: [...b[col], { id: rid(), text: t }] })); setDrafts((d) => ({ ...d, [col]: '' })) }
  function move(col: Col, id: string, dir: -1 | 1) {
    const to = COLS[COLS.indexOf(col) + dir]; if (!to) return
    setBoard((b) => { const card = b[col].find((c) => c.id === id); if (!card) return b; return { ...b, [col]: b[col].filter((c) => c.id !== id), [to]: [...b[to], card] } })
  }
  function del(col: Col, id: string) { setBoard((b) => ({ ...b, [col]: b[col].filter((c) => c.id !== id) })) }

  return (
    <Stack data-testid="kanban">
      <div className="grid gap-3 md:grid-cols-3">
        {COLS.map((col, ci) => (
          <div key={col} className="flex flex-col gap-2 bg-[color-mix(in_srgb,var(--ink)_3%,var(--surface))] rounded-lg p-2 border border-[color:var(--line-soft)]">
            <h3 className="text-[0.82rem] font-semibold text-ink-soft px-1 flex items-center justify-between">{s[col]} <span className="text-ink-faint font-mono">{board[col].length}</span></h3>
            <div className="flex gap-1">
              <Input value={drafts[col]} onChange={(e) => setDrafts((d) => ({ ...d, [col]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') add(col) }} placeholder={s.add} data-testid={`kb-input-${col}`} className="text-[0.85rem]" />
              <Button onClick={() => add(col)} data-testid={`kb-add-${col}`} aria-label="add">+</Button>
            </div>
            {board[col].map((c) => (
              <div key={c.id} className="group bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-2 shadow-[var(--shadow-sm)] text-[0.9rem]" data-testid="kb-card">
                <p className="text-ink break-words">{c.text}</p>
                <div className="flex items-center gap-1 mt-1.5 opacity-60 group-hover:opacity-100">
                  <button type="button" disabled={ci === 0} onClick={() => move(col, c.id, -1)} className="text-ink-faint disabled:opacity-30 px-1 cursor-pointer bg-transparent border-0" aria-label="move left">←</button>
                  <button type="button" disabled={ci === 2} onClick={() => move(col, c.id, 1)} className="text-ink-faint disabled:opacity-30 px-1 cursor-pointer bg-transparent border-0" aria-label="move right">→</button>
                  <span className="flex-1" />
                  <button type="button" onClick={() => del(col, c.id)} className="text-ink-faint hover:text-[color:var(--danger)] cursor-pointer bg-transparent border-0" aria-label="delete"><TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
