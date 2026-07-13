import { useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Panel, Button, Input, FieldLabel, Seg, SegButton } from '../../components/ui'

const STR = {
  en: { count: 'How many', sides: 'Sides', roll: 'Roll', total: 'Total', coin: 'Flip a coin', dice: 'Dice', heads: 'Heads', tails: 'Tails', results: 'Results', privacy: 'Fair randomness in your browser — nothing is uploaded.' },
  ar: { count: 'كم حبّة', sides: 'الأوجه', roll: 'ارمِ', total: 'المجموع', coin: 'اقلب عملة', dice: 'نرد', heads: 'صورة', tails: 'كتابة', results: 'النتائج', privacy: 'عشوائية عادلة في متصفحك — لا يُرفع أي شيء.' },
}

const SIDES = [4, 6, 8, 10, 12, 20]
const rollDie = (sides: number) => (crypto.getRandomValues(new Uint32Array(1))[0] % sides) + 1

export default function DiceRollerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [mode, setMode] = useState<'dice' | 'coin'>('dice')
  const [count, setCount] = useState(2)
  const [sides, setSides] = useState(6)
  const [rolls, setRolls] = useState<number[]>([])
  const [coin, setCoin] = useState<string>('')

  function roll() {
    const n = Math.min(50, Math.max(1, count))
    setRolls(Array.from({ length: n }, () => rollDie(sides)))
  }
  function flip() { setCoin(crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0 ? s.heads : s.tails) }

  const total = rolls.reduce((a, b) => a + b, 0)

  return (
    <Stack data-testid="dice-roller">
      <Seg className="self-center">
        <SegButton active={mode === 'dice'} onClick={() => setMode('dice')} data-testid="dr-mode-dice">{s.dice}</SegButton>
        <SegButton active={mode === 'coin'} onClick={() => setMode('coin')} data-testid="dr-mode-coin">{s.coin}</SegButton>
      </Seg>

      {mode === 'dice' ? (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-[0.4rem] w-24"><FieldLabel>{s.count}</FieldLabel>
              <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.min(50, Math.max(1, Math.floor(Number(e.target.value) || 1))))} className="font-mono" data-testid="dr-count" /></label>
            <div className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.sides}</FieldLabel>
              <div className="flex flex-wrap gap-1">
                {SIDES.map((sd) => (
                  <button key={sd} type="button" onClick={() => setSides(sd)} data-testid={`dr-d${sd}`}
                    className={`px-3 py-1.5 rounded-md border text-[0.85rem] font-mono cursor-pointer ${sides === sd ? 'bg-green-600 text-sand-100 border-green-600' : 'bg-[var(--surface)] border-[color:var(--line)] text-ink-soft'}`}>d{sd}</button>
                ))}
              </div></div>
            <Button variant="primary" onClick={roll} data-testid="dr-roll">{s.roll}</Button>
          </div>

          {rolls.length > 0 && (
            <Panel className="text-center">
              <div className="flex flex-wrap gap-2 justify-center" data-testid="dr-results">
                {rolls.map((v, i) => <span key={i} className="w-11 h-11 flex items-center justify-center rounded-md border border-[color:var(--line)] bg-[var(--surface)] font-mono font-bold text-[1.1rem] text-ink">{v}</span>)}
              </div>
              {rolls.length > 1 && <p className="text-[0.9rem] text-ink-soft">{s.total}: <b className="font-mono text-green-700 text-[1.3rem]" data-testid="dr-total">{total}</b></p>}
            </Panel>
          )}
        </>
      ) : (
        <Panel className="text-center gap-4">
          <Button variant="primary" onClick={flip} className="self-center" data-testid="dr-flip">{s.coin}</Button>
          {coin && <p className="text-[2.4rem] font-display font-bold text-green-700" data-testid="dr-coin">{coin}</p>}
        </Panel>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
