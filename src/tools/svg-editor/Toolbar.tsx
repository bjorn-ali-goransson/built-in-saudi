// The tool strip: pick a tool (select / pan / rect / ellipse / line / pen / text)
// and the global actions (undo / redo). Icons are inline SVG (no emoji).
import type { Editor, Tool } from './useEditor'

type Str = { select: string; node: string; pan: string; rect: string; ellipse: string; line: string; pen: string; text: string; undo: string; redo: string }

const I = {
  select: <path d="M5 3l14 7-6 2-2 6z" />,
  node: <><path d="M5 17c3-8 11-8 14 0" /><rect x="3" y="15" width="4" height="4" rx="0.5" /><rect x="17" y="15" width="4" height="4" rx="0.5" /><rect x="10" y="4" width="4" height="4" rx="0.5" /></>,
  pan: <path d="M9 11V6a1.5 1.5 0 013 0v4m0 0V4.5a1.5 1.5 0 013 0V11m0-1a1.5 1.5 0 013 0v5a5 5 0 01-5 5h-1.6a4 4 0 01-2.9-1.2L6 15.5a1.5 1.5 0 012.2-2L9 14" />,
  rect: <rect x="4" y="6" width="16" height="12" rx="1" />,
  ellipse: <ellipse cx="12" cy="12" rx="8" ry="6" />,
  line: <path d="M5 19L19 5" />,
  pen: <path d="M4 20c2-6 5-11 9-14 2-1.5 4 .5 3 3-2 4-8 8-12 11z" />,
  text: <path d="M6 5h12M12 5v14M9 19h6" />,
}

const TOOLS: { tool: Tool; icon: keyof typeof I; key: keyof Str }[] = [
  { tool: 'select', icon: 'select', key: 'select' },
  { tool: 'node', icon: 'node', key: 'node' },
  { tool: 'pan', icon: 'pan', key: 'pan' },
  { tool: 'rect', icon: 'rect', key: 'rect' },
  { tool: 'ellipse', icon: 'ellipse', key: 'ellipse' },
  { tool: 'line', icon: 'line', key: 'line' },
  { tool: 'path', icon: 'pen', key: 'pen' },
  { tool: 'text', icon: 'text', key: 'text' },
]

function Ico({ name, fill }: { name: keyof typeof I; fill?: boolean }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{I[name]}</svg>
}

export function Toolbar({ ed, t }: { ed: Editor; t: Str }) {
  return (
    <div className="flex items-center gap-1 flex-wrap" data-testid="svg-toolbar">
      {TOOLS.map(({ tool, icon, key }) => {
        const active = ed.tool === tool
        return (
          <button key={tool} type="button" onClick={() => ed.setTool(tool)} title={t[key]} aria-label={t[key]} aria-pressed={active} data-testid={`svg-tool-${tool}`}
            className={`w-9 h-9 grid place-items-center rounded-md border cursor-pointer transition-colors ${active ? 'bg-green-600 text-white border-green-600' : 'bg-paper text-ink-soft border-[color:var(--line-soft)] hover:bg-black/5'}`}>
            <Ico name={icon} fill={icon === 'select'} />
          </button>
        )
      })}
      <span className="w-px h-6 bg-[color:var(--line-soft)] mx-1" />
      <button type="button" onClick={ed.undo} disabled={!ed.canUndo} title={t.undo} aria-label={t.undo} data-testid="svg-undo"
        className="w-9 h-9 grid place-items-center rounded-md border border-[color:var(--line-soft)] bg-paper text-ink-soft hover:bg-black/5 cursor-pointer disabled:opacity-30">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-1" /></svg>
      </button>
      <button type="button" onClick={ed.redo} disabled={!ed.canRedo} title={t.redo} aria-label={t.redo} data-testid="svg-redo"
        className="w-9 h-9 grid place-items-center rounded-md border border-[color:var(--line-soft)] bg-paper text-ink-soft hover:bg-black/5 cursor-pointer disabled:opacity-30">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h1" /></svg>
      </button>
    </div>
  )
}
