import { useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { Textarea, Field, Stack, Panel, FileError, Disclaimer } from '../../components/ui'
import { UploadIcon, CameraIcon } from '../../components/icons'
import { decodeImage } from '../../lib/decodeImage'
import { whyUnreadable } from '../../lib/imageInput'
import { impliedRate, parseInvoice, type NoteKey } from './tlv'

const STR = {
  en: {
    intro: 'Every compliant invoice in the Kingdom carries a QR with the seller, their VAT number, the time, the total and the VAT. Photograph the receipt, or paste the QR text, and read what it says. Nothing leaves this page.',
    photo: 'Photograph or upload the receipt',
    paste: 'Or paste the QR text',
    placeholder: 'ARLYtNix2YPYqSD…',
    seller: 'Seller', vatNumber: 'VAT number', when: 'Issued', total: 'Total (with VAT)', vat: 'VAT', net: 'Before VAT', rate: 'Implied rate',
    fields: 'Every field in the code',
    notes: {
      'phase-1': 'A phase-1 code: the invoice facts only, with no cryptographic stamp.',
      'phase-2': 'A phase-2 code: it carries a hash and a signature as well as the facts.',
      'bad-vat-number': 'That VAT number is not the Saudi shape — 15 digits beginning and ending with 3. Worth a second look at the receipt.',
      'bad-timestamp': 'The timestamp could not be read as a date.',
      'bad-total': 'The total is not a number.',
      'vat-rate-off': 'The VAT does not work out to 15% of the pre-VAT amount. That can be legitimate — zero-rated or exempt items, or a mixed basket — but on an ordinary standard-rated sale it means something is wrong.',
      'trailing-bytes': 'There were bytes left over after the last field. The code may be truncated or from a different scheme.',
    } as Record<NoteKey, string>,
    notQr: 'No QR code was found in that image. Get closer, avoid glare, and keep the whole square in frame.',
    notTlv: 'That is not a ZATCA invoice code. It decodes, but not as the tag-length-value run a Saudi e-invoice QR contains — an ordinary QR with a link or text in it will land here.',
    scanning: 'Looking for a code…',
    verifyTitle: 'This reads the invoice; it does not verify it',
    verify: 'Everything shown is what the code CLAIMS. A phase-2 code carries a hash and an ECDSA signature, and checking those against the seller’s certificate needs ZATCA’s own chain — which is not something a page in your browser can do. Treat this as reading the receipt, not as authenticating it, and take a real dispute to ZATCA.',
    bytesNote: 'The length in this format counts BYTES, not letters. An Arabic seller name is two bytes a letter, so a decoder that counts characters lands in the middle of the next field and everything after it comes out as nonsense — which is why an Arabic receipt is the one worth testing with.',
  },
  ar: {
    intro: 'تحمل كل فاتورة ملتزمة في المملكة رمزًا يحوي البائع ورقمه الضريبي والوقت والإجمالي والضريبة. صوّر الإيصال أو الصق نص الرمز واقرأ ما فيه. ولا يغادر شيء هذه الصفحة.',
    photo: 'صوّر الإيصال أو ارفع صورته',
    paste: 'أو الصق نص الرمز',
    placeholder: 'ARLYtNix2YPYqSD…',
    seller: 'البائع', vatNumber: 'الرقم الضريبي', when: 'تاريخ الإصدار', total: 'الإجمالي (شامل الضريبة)', vat: 'الضريبة', net: 'قبل الضريبة', rate: 'النسبة المحتسبة',
    fields: 'كل الحقول في الرمز',
    notes: {
      'phase-1': 'رمز المرحلة الأولى: بيانات الفاتورة فقط، بلا ختم تشفيري.',
      'phase-2': 'رمز المرحلة الثانية: يحمل بصمة وتوقيعًا إضافةً إلى البيانات.',
      'bad-vat-number': 'هذا الرقم الضريبي ليس على الصيغة السعودية — ١٥ رقمًا تبدأ وتنتهي بـ٣. يستحق نظرة ثانية في الإيصال.',
      'bad-timestamp': 'تعذّرت قراءة الطابع الزمني تاريخًا.',
      'bad-total': 'الإجمالي ليس رقمًا.',
      'vat-rate-off': 'الضريبة لا تساوي ١٥٪ من المبلغ قبل الضريبة. وقد يكون ذلك سليمًا — أصناف معفاة أو صفرية أو سلة مختلطة — لكنه في بيع خاضع للنسبة العادية يعني أن ثمة خطأً.',
      'trailing-bytes': 'بقيت بايتات بعد آخر حقل. قد يكون الرمز مبتورًا أو من نظام آخر.',
    } as Record<NoteKey, string>,
    notQr: 'لم يُعثر على رمز في هذه الصورة. اقترب، وتجنّب الانعكاس، وأبقِ المربع كاملًا في الإطار.',
    notTlv: 'هذا ليس رمز فاتورة زاتكا. فهو يُفك، لكن ليس على صيغة «وسم-طول-قيمة» التي يحويها رمز الفاتورة السعودية — والرمز العادي الذي يحمل رابطًا أو نصًا سينتهي هنا.',
    scanning: 'جارٍ البحث عن رمز…',
    verifyTitle: 'تقرأ الأداة الفاتورة ولا تتحقق منها',
    verify: 'كل ما يُعرض هو ما يدّعيه الرمز. ورمز المرحلة الثانية يحمل بصمة وتوقيعًا، والتحقق منهما مقابل شهادة البائع يحتاج سلسلة شهادات زاتكا نفسها — وهذا ما لا تستطيعه صفحة في متصفحك. فاعتبرها قراءةً للإيصال لا توثيقًا له، وارفع أي نزاع حقيقي إلى زاتكا.',
    bytesNote: 'الطول في هذه الصيغة يُحسب بالبايتات لا بالحروف. والحرف العربي بايتان، فالمفكِّك الذي يعدّ الحروف يقع في وسط الحقل التالي ويخرج ما بعده هراءً — ولهذا فالإيصال العربي هو ما يستحق الاختبار به.',
  },
}

async function readQrFromImage(file: File): Promise<string | null> {
  const bitmap = await decodeImage(file)
  // decodeImage returns null for anything it cannot decode — including a HEIC
  // whose wasm fallback failed — and the caller turns that into the same "no
  // code found" message, which is what it means to whoever took the photo.
  if (!bitmap) return null
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const jsQR = (await import('jsqr')).default
  return jsQR(data, w, h, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

export default function ZatcaQrTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [payload, setPayload] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)

  const invoice = useMemo(() => (payload.trim() ? parseInvoice(payload) : null), [payload])
  const rate = useMemo(() => (invoice ? impliedRate(invoice.total, invoice.vat) : null), [invoice])

  async function pick(file: File | undefined | null) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const why = await whyUnreadable(file, locale)
      if (why) { setError(why); return }
      const text = await readQrFromImage(file)
      if (!text) { setError(s.notQr); return }
      setPayload(text)
    } catch {
      setError(s.notQr)
    } finally { setBusy(false) }
  }

  const net = invoice && isFinite(Number(invoice.total)) && isFinite(Number(invoice.vat))
    ? (Number(invoice.total) - Number(invoice.vat)).toFixed(2)
    : ''

  return (
    <Stack data-testid="zatca-qr">
      <Panel className="gap-3">
        <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 px-[1.15rem] py-[0.7rem] rounded-md border border-green-700 bg-green-600 text-[color:var(--primary-ink)] font-semibold text-[0.95rem] cursor-pointer">
            <CameraIcon /> {s.photo}
            <input ref={cameraRef} type="file" capture="environment" className="hidden" data-testid="zq-camera"
              onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-[0.9rem] cursor-pointer">
            <UploadIcon />
            <input type="file" className="hidden" data-testid="zq-file" onChange={(e) => { void pick(e.target.files?.[0]) }} />
          </label>
        </div>
      </Panel>

      <Field label={s.paste}>
        <Textarea rows={3} dir="ltr" className="font-mono text-[0.8rem]" value={payload} placeholder={s.placeholder}
          data-testid="zq-input" onChange={(e) => { setPayload(e.target.value); setError('') }} />
      </Field>

      {busy && <p className="text-ink-faint rtl:font-ar" data-testid="zq-scanning">{s.scanning}</p>}
      {error && <FileError message={error} />}
      {!!payload.trim() && !invoice && !error && (
        <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="zq-not-tlv">{s.notTlv}</p>
      )}

      {invoice && (
        <>
          <Panel className="gap-3" data-testid="zq-result">
            <div>
              <span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.seller}</span>
              <p className="font-display text-[1.4rem] text-ink" dir="auto" data-testid="zq-seller">{invoice.sellerName || '—'}</p>
            </div>
            <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4 text-[0.9rem]">
              <div><span className="block text-[0.7rem] uppercase text-ink-faint">{s.vatNumber}</span><span className="font-mono text-ink" data-testid="zq-vatno">{invoice.vatNumber || '—'}</span></div>
              <div><span className="block text-[0.7rem] uppercase text-ink-faint">{s.when}</span><span className="text-ink" data-testid="zq-when">{invoice.timestamp || '—'}</span></div>
              <div><span className="block text-[0.7rem] uppercase text-ink-faint">{s.total}</span><span className="font-mono text-ink" data-testid="zq-total">{invoice.total || '—'}</span></div>
              <div><span className="block text-[0.7rem] uppercase text-ink-faint">{s.vat}</span><span className="font-mono text-ink" data-testid="zq-vat">{invoice.vat || '—'}</span></div>
            </div>
            {net && (
              <div className="flex flex-wrap gap-x-6 text-[0.85rem] text-ink-faint">
                <span>{s.net} <b className="font-mono text-ink">{net}</b></span>
                {rate != null && (
                  <span>{s.rate} <b className={`font-mono ${Math.abs(rate - 0.15) > 0.005 ? 'text-gold-500' : 'text-green-700'}`} data-testid="zq-rate">
                    {(rate * 100).toFixed(1)}%
                  </b></span>
                )}
              </div>
            )}
          </Panel>

          <div className="flex flex-col gap-2" data-testid="zq-notes">
            {invoice.notes.map((n) => (
              <p key={n} data-testid={`zq-note-${n}`}
                className={`text-[0.88rem] leading-snug rtl:font-ar ${n === 'phase-1' || n === 'phase-2' ? 'text-ink-faint' : 'text-ink border-s-[3px] border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)] ps-3 pe-3 py-2 rounded-e-md'}`}>
                {s.notes[n]}
              </p>
            ))}
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.fields}</h2>
            <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]">
              <table className="w-full text-[0.82rem] border-collapse" data-testid="zq-fields">
                <tbody>
                  {invoice.fields.map((f) => (
                    <tr key={f.tag} className="border-t border-[color:var(--line-soft)] first:border-t-0">
                      <td className="px-3 py-1.5 font-mono text-ink-faint whitespace-nowrap">{f.tag}</td>
                      <td className="px-3 py-1.5 text-ink-soft whitespace-nowrap">{f.name}</td>
                      <td className="px-3 py-1.5 text-ink break-all" dir="auto">{f.value}</td>
                      <td className="px-3 py-1.5 font-mono text-ink-faint whitespace-nowrap">{f.bytes} B</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.bytesNote}</p>
          </section>
        </>
      )}

      <Disclaimer kind="official" locale={locale}>
        <b>{s.verifyTitle}.</b> {s.verify}
      </Disclaimer>
    </Stack>
  )
}
