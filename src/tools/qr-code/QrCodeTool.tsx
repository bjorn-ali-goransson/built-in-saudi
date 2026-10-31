import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n'
import { Seg, SegButton } from '../../components/ui'
import QrMaker from './QrMaker'
import BarcodeMaker from './BarcodeMaker'

// A QR code and a product barcode are, to almost everybody here, the same word
// — «باركود» — and the same job: put a code on something. The barcode
// generator was its own app until November 2026; it is the second kind here,
// and `/apps/barcode` lands on it through `?mode=barcode`.

type Kind = 'qr' | 'barcode'

const STR = {
  en: { qr: 'QR code', barcode: 'Barcode (EAN, UPC, Code 128)', kind: 'Kind of code' },
  ar: { qr: 'رمز QR', barcode: 'باركود (EAN وUPC وCode 128)', kind: 'نوع الرمز' },
}

export default function QrCodeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [params] = useSearchParams()
  const [kind, setKind] = useState<Kind>(params.get('mode') === 'barcode' ? 'barcode' : 'qr')
  return (
    <div className="flex flex-col gap-4" data-testid="code-maker">
      <Seg role="group" aria-label={s.kind} className="self-start">
        {(['qr', 'barcode'] as Kind[]).map((k) => (
          <SegButton key={k} active={kind === k} aria-pressed={kind === k} data-testid={`cm-kind-${k}`} onClick={() => setKind(k)}>{s[k]}</SegButton>
        ))}
      </Seg>
      {kind === 'qr' ? <QrMaker /> : <BarcodeMaker />}
    </div>
  )
}
