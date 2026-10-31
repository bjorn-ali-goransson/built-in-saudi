import { useEffect, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Seg, SegButton } from '../../components/ui'
import NameWheel from './NameWheel'
import TeamMaker from './TeamMaker'
import DiceRoller from './DiceRoller'

// Three ways of letting chance decide, in one place: spin for a name, split a
// list into teams, or roll dice and flip a coin. The team maker and the dice
// roller were their own apps until November 2026; they take the same kind of
// question to the same kind of answer, and a teacher at the front of a class
// reaches for all three within a lesson.

type Mode = 'wheel' | 'teams' | 'dice'
const KEY = 'bis-random-mode'

const STR = {
  en: { wheel: 'Wheel of names', teams: 'Make teams', dice: 'Dice & coin', mode: 'What to do' },
  ar: { wheel: 'عجلة الأسماء', teams: 'قسّم إلى فرق', dice: 'نرد وعملة', mode: 'ماذا تريد' },
}

export default function SpinWheelTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  // Remembered, like the lists each mode keeps: somebody who makes teams every
  // lesson should come back to the teams, not to a wheel.
  const [mode, setMode] = useState<Mode>(() => {
    try { const v = localStorage.getItem(KEY); return v === 'teams' || v === 'dice' ? v : 'wheel' } catch { return 'wheel' }
  })
  useEffect(() => { try { localStorage.setItem(KEY, mode) } catch { /* private window */ } }, [mode])
  return (
    <Stack data-testid="random-picker">
      <Seg role="group" aria-label={s.mode} className="self-start">
        {(['wheel', 'teams', 'dice'] as Mode[]).map((m) => (
          <SegButton key={m} active={mode === m} aria-pressed={mode === m} data-testid={`rp-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</SegButton>
        ))}
      </Seg>
      {mode === 'wheel' ? <NameWheel /> : mode === 'teams' ? <TeamMaker /> : <DiceRoller />}
    </Stack>
  )
}
