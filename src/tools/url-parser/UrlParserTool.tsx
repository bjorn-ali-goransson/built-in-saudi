import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n'
import { Stack, Seg, SegButton } from '../../components/ui'
import Parser from './Parser'
import Encoder from './Encoder'

// Pulling a URL apart and percent-encoding a piece of one are the same errand.
// The URL & HTML Encoder was its own app until November 2026; `/apps/url-encoder`
// lands on its mode through `?mode=encode`.

type Mode = 'parse' | 'encode'

const STR = {
  en: { parse: 'Parse & build', encode: 'Encode & decode', mode: 'What to do' },
  ar: { parse: 'فكّك وأعد البناء', encode: 'رمّز وفكّ الترميز', mode: 'ماذا تريد' },
}

export default function UrlParserTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'encode' ? 'encode' : 'parse')
  return (
    <Stack data-testid="url-tools">
      <Seg role="group" aria-label={s.mode} className="self-start">
        {(['parse', 'encode'] as Mode[]).map((m) => (
          <SegButton key={m} active={mode === m} aria-pressed={mode === m} data-testid={`ut-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</SegButton>
        ))}
      </Seg>
      {mode === 'parse' ? <Parser /> : <Encoder />}
    </Stack>
  )
}
