import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../i18n'
import { DownloadIcon, ShareIcon, ExpandIcon } from '../../components/icons'
import { tafqeetSAR } from '../tafqeet/tafqeet'
import { Stack, Button, Disclaimer } from '../../components/ui'

interface Row { id: string; desc: string; qty: string; price: string }
let uid = 0
const nid = () => `r${uid++}`

const STR = {
  en: {
    title: 'INVOICE', from: 'From', to: 'Bill to', seller: 'Your business name', vatNo: 'VAT number', buyer: 'Customer name',
    invNo: 'Invoice #', date: 'Date', desc: 'Description', qty: 'Qty', price: 'Unit price', lineTotal: 'Total', item: 'Item description',
    addRow: 'Add line', subtotal: 'Subtotal', vat: 'VAT', total: 'Total due', inWords: 'In words',
    print: 'Print / Save as PDF', share: 'Share', preview: 'Preview', close: 'Close',
    privacy: 'Made on your device — nothing is uploaded; your seller details are saved locally.',
  },
  ar: {
    title: 'فاتورة', from: 'من', to: 'إلى', seller: 'اسم نشاطك التجاري', vatNo: 'الرقم الضريبي', buyer: 'اسم العميل',
    invNo: 'رقم الفاتورة', date: 'التاريخ', desc: 'الوصف', qty: 'الكمية', price: 'سعر الوحدة', lineTotal: 'الإجمالي', item: 'وصف البند',
    addRow: 'إضافة بند', subtotal: 'المجموع الفرعي', vat: 'الضريبة', total: 'الإجمالي المستحق', inWords: 'كتابةً',
    print: 'طباعة / حفظ PDF', share: 'مشاركة', preview: 'معاينة', close: 'إغلاق',
    privacy: 'يُنشأ على جهازك — لا يُرفع شيء؛ وتُحفظ بيانات نشاطك محليًا.',
  },
}
const SELLER_KEY = 'bis-invoice-seller'

export default function InvoiceGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const money = useMemo(() => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', { style: 'currency', currency: 'SAR' }), [locale])

  const saved = (() => { try { return JSON.parse(localStorage.getItem(SELLER_KEY) || '{}') } catch { return {} } })()
  const [seller, setSeller] = useState(saved.name || '')
  const [vatNo, setVatNo] = useState(saved.vat || '')
  const [buyer, setBuyer] = useState('')
  const [invNo, setInvNo] = useState('INV-1001')
  const [date, setDate] = useState('')
  const [vatRate, setVatRate] = useState('15')
  const [rows, setRows] = useState<Row[]>([{ id: nid(), desc: '', qty: '1', price: '' }])
  const [zoom, setZoom] = useState(false)

  useEffect(() => { localStorage.setItem(SELLER_KEY, JSON.stringify({ name: seller, vat: vatNo })) }, [seller, vatNo])
  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [zoom])

  const lineTotal = (r: Row) => (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0)
  const subtotal = rows.reduce((n, r) => n + lineTotal(r), 0)
  const vat = subtotal * (Math.max(0, parseFloat(vatRate) || 0) / 100)
  const total = subtotal + vat

  const setRow = (id: string, patch: Partial<Row>) => setRows((cur) => cur.map((r) => r.id === id ? { ...r, ...patch } : r))
  const addRow = () => setRows((cur) => [...cur, { id: nid(), desc: '', qty: '1', price: '' }])
  const delRow = (id: string) => setRows((cur) => cur.length > 1 ? cur.filter((r) => r.id !== id) : cur)

  const inp = 'bg-transparent border-0 border-b border-dashed border-[color:var(--line)] focus:border-green-500 outline-none py-1 min-w-0'

  async function share() {
    const lines = rows.filter((r) => r.desc || parseFloat(r.price)).map((r) => `• ${r.desc || s.item} ×${r.qty} = ${money.format(lineTotal(r))}`)
    const text = [`${s.title} ${invNo}`, seller && `${s.from}: ${seller}`, buyer && `${s.to}: ${buyer}`, '', ...lines, '', `${s.total}: ${money.format(total)}`, total > 0 ? tafqeetSAR(total) : ''].filter(Boolean).join('\n')
    if (navigator.share) { try { await navigator.share({ title: `${s.title} ${invNo}`, text }) } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(text) } catch { /* ignore */ } }
  }

  // The invoice document, editable or read-only (for the preview + print).
  function Doc({ ro }: { ro: boolean }) {
    const T = (v: string, set: (x: string) => void, ph: string, cls = '', type = 'text', tid?: string) =>
      ro ? <span className={cls}>{v || ph}</span> : <input className={`${inp} ${cls}`} type={type} value={v} placeholder={ph} data-testid={tid} onChange={(e) => set(e.target.value)} />
    return (
      <div className={`${ro ? '' : 'invoice-print'} bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-5 sm:p-8 flex flex-col gap-6`}>
        <div className="flex flex-wrap justify-between items-start gap-4">
          <h2 className="font-display text-[2rem] text-green-700 tracking-wide">{s.title}</h2>
          <div className="flex flex-col gap-1 text-[0.9rem] items-end rtl:items-start">
            <label className="flex gap-2 items-center"><span className="text-ink-faint">{s.invNo}</span>{T(invNo, setInvNo, '—', 'text-end w-28')}</label>
            <label className="flex gap-2 items-center"><span className="text-ink-faint">{s.date}</span>{T(date, setDate, '—', 'text-end w-36', 'date')}</label>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{s.from}</span>
            {T(seller, setSeller, s.seller, 'font-semibold text-[1.05rem]')}
            {T(vatNo, setVatNo, s.vatNo, 'text-[0.9rem]')}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{s.to}</span>
            {T(buyer, setBuyer, s.buyer, 'font-semibold text-[1.05rem]')}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[0.9rem] border-collapse min-w-[30rem]">
            <thead>
              <tr className="text-ink-faint text-[0.72rem] uppercase tracking-[0.05em] border-b border-[color:var(--line)]">
                <th className="text-start font-semibold py-2">{s.desc}</th>
                <th className="text-end font-semibold py-2 w-16">{s.qty}</th>
                <th className="text-end font-semibold py-2 w-28">{s.price}</th>
                <th className="text-end font-semibold py-2 w-28">{s.lineTotal}</th>
                {!ro && <th className="w-8 print-hide"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-[color:var(--line-soft)]">
                  <td className="py-1 pe-2">{T(r.desc, (v) => setRow(r.id, { desc: v }), s.item, 'w-full', 'text', `inv-desc-${i}`)}</td>
                  <td className="py-1">{T(r.qty, (v) => setRow(r.id, { qty: v }), '', 'w-full text-end font-mono', 'number', `inv-qty-${i}`)}</td>
                  <td className="py-1">{T(r.price, (v) => setRow(r.id, { price: v }), '0.00', 'w-full text-end font-mono', 'number', `inv-price-${i}`)}</td>
                  <td className="py-1 text-end font-mono whitespace-nowrap" data-testid={ro ? undefined : `inv-line-${i}`}>{money.format(lineTotal(r))}</td>
                  {!ro && <td className="print-hide text-center"><button className="text-ink-faint hover:text-[color:var(--danger)] px-1" aria-label="remove" data-testid={`inv-del-${i}`} onClick={() => delRow(r.id)}>✕</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ro && <Button className="self-start print-hide" data-testid="inv-add-row" onClick={addRow}>+ {s.addRow}</Button>}
        <div className="flex flex-col gap-1 items-end rtl:items-start ms-auto rtl:ms-0 rtl:me-auto w-full sm:w-72">
          <div className="flex justify-between w-full text-ink-soft"><span>{s.subtotal}</span><span className="font-mono" data-testid={ro ? undefined : 'inv-subtotal'}>{money.format(subtotal)}</span></div>
          <div className="flex justify-between w-full text-ink-soft">
            <span className="flex items-center gap-1">{s.vat} {ro ? <span>{vatRate || 0}</span> : <input className={`${inp} w-10 text-center font-mono`} type="number" min="0" value={vatRate} data-testid="inv-vatrate" onChange={(e) => setVatRate(e.target.value)} />}%</span>
            <span className="font-mono" data-testid={ro ? undefined : 'inv-vat'}>{money.format(vat)}</span>
          </div>
          <div className="flex justify-between w-full text-green-700 font-bold text-[1.1rem] border-t border-[color:var(--line)] pt-2 mt-1"><span>{s.total}</span><span className="font-mono" data-testid={ro ? undefined : 'inv-total'}>{money.format(total)}</span></div>
        </div>
        {total > 0 && (
          <div dir="rtl" lang="ar" className="font-ar text-[0.95rem] text-ink-soft border-t border-[color:var(--line-soft)] pt-3"><span className="text-ink-faint text-[0.8rem]">{STR.ar.inWords}: </span>{tafqeetSAR(total)}</div>
        )}
      </div>
    )
  }

  return (
    <Stack data-testid="invoice-generator">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full">{Doc({ ro: false })}</div>

        {/* Miniature preview — click to zoom into a modal */}
        <button className="print-hide flex-none w-full sm:w-44 rounded-md border border-[color:var(--line)] overflow-hidden bg-white relative cursor-zoom-in group" data-testid="inv-preview" onClick={() => setZoom(true)} aria-label={s.preview}>
          <div className="h-52 overflow-hidden pointer-events-none">
            <div style={{ transform: 'scale(0.32)', transformOrigin: 'top left', width: '312%' }}>{Doc({ ro: true })}</div>
          </div>
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1.5 text-[0.78rem] font-semibold text-sand-100 bg-[color-mix(in_srgb,var(--green-700)_88%,transparent)] [&_svg]:size-4"><ExpandIcon /> {s.preview}</span>
        </button>
      </div>

      <div className="flex gap-2 print-hide">
        <Button variant="primary" data-testid="inv-print" onClick={() => window.print()}><DownloadIcon /> {s.print}</Button>
        <Button data-testid="inv-share" onClick={share}><ShareIcon /> {s.share}</Button>
      </div>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem] print-hide"><span aria-hidden="true">🔒</span> {s.privacy}</p>

      {zoom && createPortal(
        <div className="fixed inset-0 z-[100] bg-[color-mix(in_srgb,var(--ink)_55%,transparent)] flex flex-col p-3 sm:p-6 overflow-y-auto" data-testid="inv-modal" onClick={() => setZoom(false)}>
          <div className="mx-auto w-full max-w-2xl my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end gap-2 mb-2">
              <Button variant="primary" onClick={() => window.print()}><DownloadIcon /> {s.print}</Button>
              <Button onClick={share}><ShareIcon /> {s.share}</Button>
              <Button data-testid="inv-modal-close" onClick={() => setZoom(false)}>✕ {s.close}</Button>
            </div>
            <div className="shadow-[var(--shadow-md)] rounded-md">{Doc({ ro: true })}</div>
          </div>
        </div>,
        document.body,
      )}

      <Disclaimer kind="legal" locale={locale}>
        {locale === 'ar'
          ? 'هذه الأداة تُنسّق فاتورة، ولا تجعلها متوافقة مع متطلبات الفوترة الإلكترونية. فالفاتورة الضريبية النظامية لها حقول إلزامية ورمز استجابة سريعة وربط بمنصة فاتورة — راجع هيئة الزكاة والضريبة والجمارك إن كنت مسجَّلًا في ضريبة القيمة المضافة.'
          : 'This lays out an invoice; it does not make one e-invoicing compliant. A compliant tax invoice has mandatory fields, a QR code and a Fatoora integration — check with ZATCA if you are registered for VAT.'}
      </Disclaimer>
    </Stack>
  )
}
