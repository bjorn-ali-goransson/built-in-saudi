import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n'
import { Stack, Seg, SegButton } from '../../components/ui'
import Records from './Records'
import Uuids from './Uuids'

// Test data, whole records or bare ids. The UUID Generator was its own app
// until November 2026; `/apps/uuid-generator` opens the UUID mode.

type Mode = 'records' | 'uuid'

const STR = {
  en: { records: 'Records', uuid: 'UUIDs', mode: 'What to make' },
  ar: { records: 'سجلّات', uuid: 'معرّفات UUID', mode: 'ماذا تريد' },
}

export default function FakeDataTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'uuid' ? 'uuid' : 'records')
  return (
    <Stack data-testid="test-data">
      <Seg role="group" aria-label={s.mode} className="self-start">
        {(['records', 'uuid'] as Mode[]).map((m) => (
          <SegButton key={m} active={mode === m} aria-pressed={mode === m} data-testid={`td-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</SegButton>
        ))}
      </Seg>
      {mode === 'records' ? <Records /> : <Uuids />}
    </Stack>
  )
}
