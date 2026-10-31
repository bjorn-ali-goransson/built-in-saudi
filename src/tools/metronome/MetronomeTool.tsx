import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n'
import { Stack, Seg, SegButton } from '../../components/ui'
import Clicker from './Clicker'
import TapTempo from './TapTempo'

// Keeping a tempo and finding one are the two halves of the same job, and a
// tapped tempo is exactly what you then want the metronome to play. Tap BPM was
// its own app until November 2026; `/apps/bpm-tap` opens this mode.

type Mode = 'click' | 'tap'

const STR = {
  en: { click: 'Metronome', tap: 'Tap the tempo', mode: 'What to do' },
  ar: { click: 'الميقاتية', tap: 'انقر لقياس الإيقاع', mode: 'ماذا تريد' },
}

export default function MetronomeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'tap' ? 'tap' : 'click')
  return (
    <Stack data-testid="tempo-tools">
      <Seg role="group" aria-label={s.mode} className="self-start">
        {(['click', 'tap'] as Mode[]).map((m) => (
          <SegButton key={m} active={mode === m} aria-pressed={mode === m} data-testid={`mt-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</SegButton>
        ))}
      </Seg>
      {mode === 'click' ? <Clicker /> : <TapTempo />}
    </Stack>
  )
}
