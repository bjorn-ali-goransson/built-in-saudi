import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n'
import { Stack, Seg, SegButton } from '../../components/ui'
import Converter from './Converter'
import Spectrum from './Spectrum'

// Converting a recording and looking at what is in it are the same file in the
// same hands — the spectrum is how you check that a "320 kbps" MP3 is not a 128
// one in disguise before converting it. The Audio Spectrum Analyser was its own
// app until November 2026; `/apps/audio-spectrum` opens this mode.

type Mode = 'convert' | 'spectrum'

const STR = {
  en: { convert: 'Convert', spectrum: 'Look at the frequencies', mode: 'What to do' },
  ar: { convert: 'حوّل', spectrum: 'اعرض الترددات', mode: 'ماذا تريد' },
}

export default function AudioConvertTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'spectrum' ? 'spectrum' : 'convert')
  return (
    <Stack data-testid="audio-tools">
      <Seg role="group" aria-label={s.mode} className="self-start">
        {(['convert', 'spectrum'] as Mode[]).map((m) => (
          <SegButton key={m} active={mode === m} aria-pressed={mode === m} data-testid={`at-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</SegButton>
        ))}
      </Seg>
      {mode === 'convert' ? <Converter /> : <Spectrum />}
    </Stack>
  )
}
