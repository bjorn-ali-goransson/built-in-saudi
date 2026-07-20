// Right-hand panel: style controls for the selected shape (fill / stroke / width /
// opacity, plus text content) and a layers list (select, reorder, delete).
import type { Editor } from './useEditor'
import type { Shape } from './model'
import { ChevronDownIcon, TrashIcon } from '../../components/icons'

type Str = {
  none: string; fill: string; stroke: string; width: string; opacity: string; text: string; size: string
  layers: string; empty: string; up: string; down: string; del: string; nothing: string
}

const isHex = (c: string) => /^#[0-9a-fA-F]{3,8}$/.test(c)

function label(s: Shape, i: number): string {
  const n = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', path: 'Path', text: 'Text', raw: 'Imported' }[s.type]
  return `${n} ${i + 1}`
}

export function Inspector({ ed, t }: { ed: Editor; t: Str }) {
  const s = ed.selectedShape
  const shapes = ed.doc.shapes
  return (
    <div className="flex flex-col gap-4 text-[0.85rem]" data-testid="svg-inspector">
      {s ? (
        <div className="flex flex-col gap-3">
          {s.type !== 'line' && s.type !== 'raw' && (
            <ColorRow label={t.fill} value={s.type === 'path' && !s.closed ? 'none' : s.fill} onColor={(c) => ed.restyle(s.id, { fill: c })} noneLabel={t.none} onNone={() => ed.restyle(s.id, { fill: 'none' })} testid="svg-fill" />
          )}
          {s.type !== 'text' && (
            <ColorRow label={t.stroke} value={s.strokeWidth > 0 ? s.stroke : 'none'} onColor={(c) => ed.restyle(s.id, { stroke: c, strokeWidth: s.strokeWidth || 2 })} noneLabel={t.none} onNone={() => ed.restyle(s.id, { strokeWidth: 0 })} testid="svg-stroke" />
          )}
          {s.type !== 'text' && (
            <Range label={t.width} min={0} max={40} step={0.5} value={s.strokeWidth} onChange={(v) => ed.restyle(s.id, { strokeWidth: v })} testid="svg-strokewidth" />
          )}
          <Range label={t.opacity} min={0} max={1} step={0.05} value={s.opacity} onChange={(v) => ed.restyle(s.id, { opacity: v })} testid="svg-opacity" />
          {s.type === 'text' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-ink-faint text-[0.78rem]">{t.text}</span>
                <input value={s.text} onChange={(e) => ed.update(s.id, { text: e.target.value })} data-testid="svg-text-content" className="rounded-md border border-[color:var(--line-soft)] px-2 py-1.5 bg-paper" />
              </label>
              <Range label={t.size} min={6} max={200} step={1} value={s.fontSize} onChange={(v) => ed.update(s.id, { fontSize: v })} testid="svg-fontsize" />
            </>
          )}
        </div>
      ) : (
        <p className="text-ink-faint text-[0.82rem]" data-testid="svg-noselection">{t.nothing}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[0.78rem] font-semibold uppercase tracking-wide text-ink-faint">{t.layers}</span>
        {shapes.length === 0 && <p className="text-ink-faint text-[0.8rem]">{t.empty}</p>}
        <ul className="flex flex-col gap-1 max-h-[30vh] overflow-auto" data-testid="svg-layers">
          {shapes.map((sh, i) => (
            <li key={sh.id} className={`flex items-center gap-1 rounded-md px-2 py-1 cursor-pointer border ${sh.id === ed.selected ? 'border-green-600 bg-green-600/8' : 'border-transparent hover:bg-black/4'}`}
              onClick={() => ed.setSelected(sh.id)} data-testid="svg-layer">
              <span className="w-4 h-4 rounded-sm border border-[color:var(--line-soft)] shrink-0" style={{ background: sh.type === 'line' || (sh.type === 'path' && !sh.closed) ? sh.stroke : sh.type === 'raw' ? '#ccc' : sh.fill }} aria-hidden="true" />
              <span className="flex-1 truncate">{label(sh, shapes.filter((x) => x.type === sh.type).indexOf(sh))}</span>
              <button type="button" title={t.up} aria-label={t.up} onClick={(e) => { e.stopPropagation(); ed.reorder(sh.id, 'up') }} disabled={i === shapes.length - 1} className="w-6 h-6 grid place-items-center rounded bg-transparent border-0 text-ink-faint hover:text-ink hover:bg-black/5 cursor-pointer disabled:opacity-30 [&_svg]:w-3.5 [&_svg]:h-3.5"><ChevronDownIcon className="rotate-180" /></button>
              <button type="button" title={t.down} aria-label={t.down} onClick={(e) => { e.stopPropagation(); ed.reorder(sh.id, 'down') }} disabled={i === 0} className="w-6 h-6 grid place-items-center rounded bg-transparent border-0 text-ink-faint hover:text-ink hover:bg-black/5 cursor-pointer disabled:opacity-30 [&_svg]:w-3.5 [&_svg]:h-3.5"><ChevronDownIcon /></button>
              <button type="button" title={t.del} aria-label={t.del} onClick={(e) => { e.stopPropagation(); ed.remove(sh.id) }} className="w-6 h-6 grid place-items-center rounded bg-transparent border-0 text-ink-faint hover:text-[var(--danger)] hover:bg-black/5 cursor-pointer [&_svg]:w-3.5 [&_svg]:h-3.5" data-testid="svg-layer-del"><TrashIcon /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ColorRow({ label, value, onColor, noneLabel, onNone, testid }: { label: string; value: string; onColor: (c: string) => void; noneLabel: string; onNone: () => void; testid: string }) {
  const on = value !== 'none'
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-ink-faint text-[0.78rem]">{label}</span>
      <input type="color" value={isHex(value) ? value : '#1f7a3f'} onChange={(e) => onColor(e.target.value)} data-testid={testid} className="w-8 h-8 rounded-md border border-[color:var(--line-soft)] bg-paper cursor-pointer p-0.5" />
      <label className="flex items-center gap-1 text-[0.78rem] text-ink-soft cursor-pointer">
        <input type="checkbox" checked={!on} onChange={(e) => (e.target.checked ? onNone() : onColor(isHex(value) ? value : '#1f7a3f'))} className="accent-green-600" /> {noneLabel}
      </label>
    </div>
  )
}

function Range({ label, min, max, step, value, onChange, testid }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; testid: string }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-14 text-ink-faint text-[0.78rem]">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} data-testid={testid} className="flex-1 accent-green-600" />
      <span className="font-mono text-ink-faint text-[0.75rem] w-9 text-end">{Number.isInteger(step) ? Math.round(value) : value.toFixed(2)}</span>
    </label>
  )
}
