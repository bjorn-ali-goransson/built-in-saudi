// A cell's mixed formatting, drawn run by run. Shared by the grid; the printout
// writes the same spans as markup.
import type { TextRun } from '../engine/model'

export function runCss(r: TextRun, zoom = 1): React.CSSProperties {
  const st: React.CSSProperties = {}
  if (r.b) st.fontWeight = 700
  if (r.i) st.fontStyle = 'italic'
  const deco = [r.u && 'underline', r.s && 'line-through'].filter(Boolean).join(' ')
  if (deco) st.textDecoration = deco
  if (r.color) st.color = r.color
  if (r.size) st.fontSize = `${(r.size * 4 / 3 * zoom).toFixed(2)}px`
  if (r.font) st.fontFamily = `"${r.font}", var(--font-body)`
  if (r.sup || r.sub) { st.verticalAlign = r.sup ? 'super' : 'sub'; st.fontSize = '0.75em' }
  return st
}

export function RunsView({ runs, zoom }: { runs: TextRun[]; zoom: number }) {
  return <>{runs.map((r, i) => <span key={i} style={runCss(r, zoom)}>{r.t}</span>)}</>
}
