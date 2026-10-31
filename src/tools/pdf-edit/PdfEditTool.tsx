import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n'
import { Stack, Seg, SegButton } from '../../components/ui'
import Edit from './Edit'
import Sign from './Sign'
import Fill from './Fill'

// Signing a PDF, filling in its form and adding text to it are all "put
// something on this document", usually the same document in one sitting. Sign
// PDF and Fill PDF Form were their own apps until November 2026; their old
// addresses open their modes through `?mode=`. The PDF picked in one mode is
// handed to the next, so switching does not ask for it again — each mode still
// saves its own result, because each writes the file a different way.

type Mode = 'edit' | 'sign' | 'fill'

const STR = {
  en: { edit: 'Add text, move images', sign: 'Sign', fill: 'Fill in a form', mode: 'What to do' },
  ar: { edit: 'أضف نصًا وحرّك الصور', sign: 'وقّع', fill: 'املأ نموذجًا', mode: 'ماذا تريد' },
}

const asMode = (v: string | null): Mode => (v === 'sign' || v === 'fill' ? v : 'edit')

export default function PdfEditTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(asMode(params.get('mode')))
  const [file, setFile] = useState<File | null>(null)
  const props = { file, onPick: setFile }
  return (
    <Stack data-testid="pdf-tools">
      <Seg role="group" aria-label={s.mode} className="self-start">
        {(['edit', 'sign', 'fill'] as Mode[]).map((m) => (
          <SegButton key={m} active={mode === m} aria-pressed={mode === m} data-testid={`pe-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</SegButton>
        ))}
      </Seg>
      {mode === 'edit' ? <Edit key="edit" {...props} /> : mode === 'sign' ? <Sign key="sign" {...props} /> : <Fill key="fill" {...props} />}
    </Stack>
  )
}
