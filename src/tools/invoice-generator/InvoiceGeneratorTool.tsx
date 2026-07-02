import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { DownloadIcon } from '../../components/icons'
import { tafqeetSAR } from '../tafqeet/tafqeet'

interface Row { id: string; desc: string; qty: string; price: string }
let uid = 0
const nid = () => `r${uid++}`

const STR = {
  en: {
    title: 'INVOICE', from: 'From', to: 'Bill to', seller: 'Your business name', vatNo: 'VAT number', buyer: 'Customer name',
    invNo: 'Invoice #', date: 'Date', desc: 'Description', qty: 'Qty', price: 'Unit price', lineTotal: 'Total', item: 'Item description',
    addRow: 'Add line', subtotal: 'Subtotal', vat: 'VAT', total: 'Total due', inWords: 'In words',
    print: 'Print / Save as PDF', privacy: 'Made on your device — nothing is uploaded; your seller details are saved locally.',
  },
  ar: {
    title: 'فاتورة', from: 'من', to: 'إلى', seller: 'اسم نشاطك التجاري', vatNo: 'الرقم الضريبي', buyer: 'اسم العميل',
    invNo: 'رقم الفاتورة', date: 'التاريخ', desc: 'الوصف', qty: 'الكمية', price: 'سعر الوحدة', lineTotal: 'الإجمالي', item: 'وصف البند',
    addRow: 'إضافة بند', subtotal: 'المجموع الفرعي', vat: 'الضريبة', total: 'الإجمالي المستحق', inWords: 'كتابةً',
    print: 'طباعة / حفظ PDF', privacy: 'يُنشأ على جهازك — لا يُرفع شيء؛ وتُحفظ بيانات نشاطك محليًا.',
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

  useEffect(() => { localStorage.setItem(SELLER_KEY, JSON.stringify({ name: seller, vat: vatNo })) }, [seller, vatNo])

  const lineTotal = (r: Row) => (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0)
  const subtotal = rows.reduce((n, r) => n + lineTotal(r), 0)
  const vat = subtotal * (Math.max(0, parseFloat(vatRate) || 0) / 100)
  const total = subtotal + vat

  const setRow = (id: string, patch: Partial<Row>) => setRows((cur) => cur.map((r) => r.id === id ? { ...r, ...patch } : r))
  const addRow = () => setRows((cur) => [...cur, { id: nid(), desc: '', qty: '1', price: '' }])
  const delRow = (id: string) => setRows((cur) => cur.length > 1 ? cur.filter((r) => r.id !== id) : cur)

  const inp = 'bg-transparent border-0 border-b border-dashed border-[color:var(--line)] focus:border-green-500 outline-none py-1 min-w-0'

  return (
    <div className="stack" data-testid="invoice-generator">
      <div className="invoice-print bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-5 sm:p-8 flex flex-col gap-6">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <h2 className="font-display text-[2rem] text-green-700 tracking-wide">{s.title}</h2>
          <div className="flex flex-col gap-1 text-[0.9rem] items-end rtl:items-start">
            <label className="flex gap-2 items-center"><span className="text-ink-faint">{s.invNo}</span>
              <input className={`${inp} text-end w-28`} value={invNo} data-testid="inv-no" onChange={(e) => setInvNo(e.target.value)} /></label>
            <label className="flex gap-2 items-center"><span className="text-ink-faint">{s.date}</span>
              <input className={`${inp} text-end w-36`} type="date" value={date} data-testid="inv-date" onChange={(e) => setDate(e.target.value)} /></label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{s.from}</span>
            <input className={`${inp} font-semibold text-[1.05rem]`} placeholder={s.seller} value={seller} data-testid="inv-seller" onChange={(e) => setSeller(e.target.value)} />
            <input className={`${inp} text-[0.9rem]`} placeholder={s.vatNo} value={vatNo} data-testid="inv-vatno" onChange={(e) => setVatNo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[0.72rem] uppercase tracking-[0.06em] text-ink-faint">{s.to}</span>
            <input className={`${inp} font-semibold text-[1.05rem]`} placeholder={s.buyer} value={buyer} data-testid="inv-buyer" onChange={(e) => setBuyer(e.target.value)} />
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
                <th className="w-8 print-hide"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-[color:var(--line-soft)]">
                  <td className="py-1 pe-2"><input className={`${inp} w-full`} placeholder={s.item} value={r.desc} data-testid={`inv-desc-${i}`} onChange={(e) => setRow(r.id, { desc: e.target.value })} /></td>
                  <td className="py-1"><input className={`${inp} w-full text-end font-mono`} type="number" min="0" value={r.qty} data-testid={`inv-qty-${i}`} onChange={(e) => setRow(r.id, { qty: e.target.value })} /></td>
                  <td className="py-1"><input className={`${inp} w-full text-end font-mono`} type="number" min="0" step="0.01" placeholder="0.00" value={r.price} data-testid={`inv-price-${i}`} onChange={(e) => setRow(r.id, { price: e.target.value })} /></td>
                  <td className="py-1 text-end font-mono whitespace-nowrap" data-testid={`inv-line-${i}`}>{money.format(lineTotal(r))}</td>
                  <td className="print-hide text-center"><button className="text-ink-faint hover:text-[color:var(--danger)] px-1" aria-label="remove" data-testid={`inv-del-${i}`} onClick={() => delRow(r.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button className="btn self-start print-hide" data-testid="inv-add-row" onClick={addRow}>+ {s.addRow}</button>

        <div className="flex flex-col gap-1 items-end rtl:items-start ms-auto rtl:ms-0 rtl:me-auto w-full sm:w-72">
          <div className="flex justify-between w-full text-ink-soft"><span>{s.subtotal}</span><span className="font-mono" data-testid="inv-subtotal">{money.format(subtotal)}</span></div>
          <div className="flex justify-between w-full text-ink-soft">
            <span className="flex items-center gap-1">{s.vat}
              <input className={`${inp} w-10 text-center font-mono`} type="number" min="0" value={vatRate} data-testid="inv-vatrate" onChange={(e) => setVatRate(e.target.value)} />%</span>
            <span className="font-mono" data-testid="inv-vat">{money.format(vat)}</span>
          </div>
          <div className="flex justify-between w-full text-green-700 font-bold text-[1.1rem] border-t border-[color:var(--line)] pt-2 mt-1"><span>{s.total}</span><span className="font-mono" data-testid="inv-total">{money.format(total)}</span></div>
        </div>

        {total > 0 && (
          <div dir="rtl" lang="ar" className="font-ar text-[0.95rem] text-ink-soft border-t border-[color:var(--line-soft)] pt-3" data-testid="inv-words">
            <span className="text-ink-faint text-[0.8rem]">{STR.ar.inWords}: </span>{tafqeetSAR(total)}
          </div>
        )}
      </div>

      <div className="flex gap-2 print-hide">
        <button className="btn btn--primary" data-testid="inv-print" onClick={() => window.print()}><DownloadIcon /> {s.print}</button>
      </div>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem] print-hide"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </div>
  )
}
