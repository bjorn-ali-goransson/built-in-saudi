import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, Button } from '../../components/ui'
import { DownloadIcon, TrashIcon } from '../../components/icons'

const KEY = 'bis-tierlist'
type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'pool'
type Item = { id: string; text: string; tier: Tier }
const TIERS: Tier[] = ['S', 'A', 'B', 'C', 'D']
const COLORS: Record<string, string> = { S: '#e35d5d', A: '#e3915d', B: '#e3c95d', C: '#8fce6b', D: '#6bb6ce' }
const rid = () => Math.random().toString(36).slice(2, 9)

const STR = {
  en: { add: 'Add an item…', pool: 'Unranked — drag into a tier', export: 'Download image', hint: 'Drag items between tiers.', privacy: 'Saved in this browser — nothing is uploaded.' },
  ar: { add: 'أضِف عنصرًا…', pool: 'غير مصنّف — اسحب إلى فئة', export: 'تنزيل الصورة', hint: 'اسحب العناصر بين الفئات.', privacy: 'تُحفظ في هذا المتصفح — لا يُرفع أي شيء.' },
}

export default function TierListTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [items, setItems] = useState<Item[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } })
  const [draft, setDraft] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* */ } }, [items])

  function add() { const t = draft.trim(); if (!t) return; setItems((i) => [...i, { id: rid(), text: t, tier: 'pool' }]); setDraft('') }
  function drop(tier: Tier) { if (!dragId) return; setItems((i) => i.map((it) => (it.id === dragId ? { ...it, tier } : it))); setDragId(null) }
  const inTier = (tier: Tier) => items.filter((i) => i.tier === tier)

  function Chip({ it }: { it: Item }) {
    return (
      <span draggable onDragStart={() => setDragId(it.id)} data-testid="tl-item"
        className="group inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--surface)] border border-[color:var(--line)] text-[0.82rem] text-ink cursor-grab active:cursor-grabbing select-none">
        {it.text}
        <button type="button" onClick={() => setItems((arr) => arr.filter((x) => x.id !== it.id))} className="text-ink-faint hover:text-[color:var(--danger)] opacity-0 group-hover:opacity-100 bg-transparent border-0 cursor-pointer" aria-label="remove">×</button>
      </span>
    )
  }

  function exportImg() {
    const rowH = 64, labelW = 64, W = 760, pad = 8
    const c = document.createElement('canvas'); c.width = W; c.height = rowH * TIERS.length + 2
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#f4ede2'; ctx.fillRect(0, 0, c.width, c.height)
    TIERS.forEach((tier, r) => {
      const y = r * rowH
      ctx.fillStyle = COLORS[tier]; ctx.fillRect(0, y, labelW, rowH)
      ctx.fillStyle = '#1a1a1a'; ctx.font = '700 26px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(tier, labelW / 2, y + rowH / 2)
      ctx.fillStyle = '#fbf7ef'; ctx.fillRect(labelW, y, W - labelW, rowH)
      ctx.strokeStyle = '#e6ddcd'; ctx.strokeRect(labelW, y, W - labelW, rowH)
      let x = labelW + pad
      ctx.font = '600 15px system-ui, sans-serif'; ctx.textAlign = 'left'
      inTier(tier).forEach((it) => {
        const w = ctx.measureText(it.text).width + 16
        if (x + w > W - pad) return
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#d8cdb8'
        ctx.beginPath(); ctx.roundRect(x, y + rowH / 2 - 14, w, 28, 6); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#1a1a1a'; ctx.fillText(it.text, x + 8, y + rowH / 2 + 1)
        x += w + 6
      })
    })
    c.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'tier-list.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }, 'image/png')
  }

  return (
    <Stack data-testid="tier-list">
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder={s.add} data-testid="tl-input" />
        <Button variant="primary" onClick={add} data-testid="tl-add">+</Button>
      </div>

      <div className="rounded-md overflow-hidden border border-[color:var(--line)]">
        {TIERS.map((tier) => (
          <div key={tier} className="flex border-b border-[color:var(--line-soft)] last:border-b-0 min-h-[56px]"
            onDragOver={(e) => e.preventDefault()} onDrop={() => drop(tier)}>
            <div className="w-16 flex items-center justify-center font-display font-bold text-[1.4rem] text-[#1a1a1a] shrink-0" style={{ background: COLORS[tier] }}>{tier}</div>
            <div className="flex-1 flex flex-wrap gap-1.5 p-2 bg-[var(--surface)]" data-testid={`tl-tier-${tier}`}>{inTier(tier).map((it) => <Chip key={it.id} it={it} />)}</div>
          </div>
        ))}
      </div>

      <div onDragOver={(e) => e.preventDefault()} onDrop={() => drop('pool')} className="rounded-md border border-dashed border-[color:var(--line)] p-2 min-h-[52px]" data-testid="tl-pool">
        <p className="text-[0.75rem] text-ink-faint mb-1">{s.pool}</p>
        <div className="flex flex-wrap gap-1.5">{inTier('pool').map((it) => <Chip key={it.id} it={it} />)}</div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={exportImg} data-testid="tl-export"><DownloadIcon /> {s.export}</Button>
        <Button onClick={() => setItems([])}><TrashIcon className="w-4 h-4" /></Button>
        <span className="text-[0.8rem] text-ink-faint">{s.hint}</span>
      </div>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
