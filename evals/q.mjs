// Ad-hoc query inspection, on the SHARED faithful index (evals/lib/tools.mjs).
import { tools } from './lib/tools.mjs'
import { scoreTool, aboveFloor } from './gen/fuzzy.js'
for (const q of process.argv.slice(2)) {
  const scored = tools.map((t) => ({ id: t.id, score: scoreTool(q, t) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score)
  console.log(`${q.padEnd(24)} ${aboveFloor(scored).slice(0, 4).map((r) => `${r.id}(${r.score.toFixed(1)})`).join(', ') || 'NOTHING'}`)
}
