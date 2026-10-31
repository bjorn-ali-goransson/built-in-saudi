import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n'
import { Stack, Seg, SegButton } from '../../components/ui'
import FromPdf from './FromPdf'
import FromPicture from './FromPicture'

// Text out of a PDF and text out of a photo are one job with one engine
// (`lib/ocr.ts`). Image to Text was its own app until November 2026;
// `/apps/image-to-text` opens the picture mode.

type Mode = 'pdf' | 'picture'

const STR = {
  en: { pdf: 'From a PDF', picture: 'From a picture', mode: 'Read text from' },
  ar: { pdf: 'من ملف PDF', picture: 'من صورة', mode: 'اقرأ النص من' },
}

export default function PdfOcrTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'picture' ? 'picture' : 'pdf')
  return (
    <Stack data-testid="text-reader">
      <Seg role="group" aria-label={s.mode} className="self-start">
        {(['pdf', 'picture'] as Mode[]).map((m) => (
          <SegButton key={m} active={mode === m} aria-pressed={mode === m} data-testid={`tr-mode-${m}`} onClick={() => setMode(m)}>{s[m]}</SegButton>
        ))}
      </Seg>
      {mode === 'pdf' ? <FromPdf /> : <FromPicture />}
    </Stack>
  )
}
