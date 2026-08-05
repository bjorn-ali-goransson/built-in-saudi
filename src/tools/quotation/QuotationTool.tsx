import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Textarea, Select, Stack, Seg, SegButton, Panel } from '../../components/ui'
import { TrashIcon, ReceiptIcon } from '../../components/icons'

type Kind = 'quotation' | 'proforma' | 'receipt'

interface Row { desc: string; qty: number; price: number }

const VAT = 15

const STR = {
  en: {
    kind: 'Document', quotation: 'Quotation', proforma: 'Proforma invoice', receipt: 'Receipt',
    from: 'From', to: 'To', number: 'Number', date: 'Date', validUntil: 'Valid until',
    paidOn: 'Paid on', method: 'Payment method', reference: 'Reference',
    items: 'Items', desc: 'Description', qty: 'Qty', price: 'Unit price', lineTotal: 'Total',
    add: 'Add a line', remove: 'Remove',
    subtotal: 'Subtotal', vat: `VAT ${VAT}%`, total: 'Total', includeVat: 'Include VAT',
    notes: 'Notes and terms', print: 'Print or save as PDF',
    currency: 'Currency',
    methods: ['Bank transfer', 'Card', 'Cash', 'Mada', 'Apple Pay', 'STC Pay'],
    disclaimerQ: 'A quotation is an offer, not a tax invoice. It does not entitle anyone to reclaim VAT — issue a proper tax invoice when the work is billed.',
    disclaimerR: 'A receipt records that payment was made. It is not a tax invoice either; if the buyer needs to reclaim VAT they need the invoice, not this.',
    received: 'Received with thanks',
    placeholderFrom: 'Your name or company\nAddress\nVAT number (if you have one)',
    placeholderTo: 'Client name\nAddress',
    placeholderNotes: 'Payment terms, delivery time, anything else.',
  },
  ar: {
    kind: 'المستند', quotation: 'عرض سعر', proforma: 'فاتورة مبدئية', receipt: 'سند قبض',
    from: 'من', to: 'إلى', number: 'الرقم', date: 'التاريخ', validUntil: 'صالح حتى',
    paidOn: 'تاريخ السداد', method: 'طريقة الدفع', reference: 'المرجع',
    items: 'البنود', desc: 'الوصف', qty: 'الكمية', price: 'سعر الوحدة', lineTotal: 'الإجمالي',
    add: 'أضف بندًا', remove: 'حذف',
    subtotal: 'المجموع', vat: `ضريبة القيمة المضافة ${VAT}%`, total: 'الإجمالي', includeVat: 'أضف الضريبة',
    notes: 'ملاحظات وشروط', print: 'اطبع أو احفظ PDF',
    currency: 'العملة',
    methods: ['تحويل بنكي', 'بطاقة', 'نقدًا', 'مدى', 'Apple Pay', 'STC Pay'],
    disclaimerQ: 'عرض السعر عرضٌ وليس فاتورة ضريبية، ولا يخوّل أحدًا خصم الضريبة — أصدر فاتورة ضريبية نظامية عند المطالبة بالعمل.',
    disclaimerR: 'سند القبض يوثّق أن السداد تم، وهو ليس فاتورة ضريبية أيضًا؛ فإن احتاج المشتري خصم الضريبة فهو يحتاج الفاتورة لا هذا السند.',
    received: 'استُلم مع الشكر',
    placeholderFrom: 'اسمك أو شركتك\nالعنوان\nالرقم الضريبي (إن وُجد)',
    placeholderTo: 'اسم العميل\nالعنوان',
    placeholderNotes: 'شروط السداد، ومدة التسليم، وأي شيء آخر.',
  },
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function QuotationTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [kind, setKind] = useState<Kind>('quotation')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [number, setNumber] = useState('Q-001')
  const [date, setDate] = useState(todayIso())
  const [valid, setValid] = useState('')
  const [method, setMethod] = useState(STR[locale].methods[0])
  const [reference, setReference] = useState('')
  const [currency, setCurrency] = useState('SAR')
  const [withVat, setWithVat] = useState(true)
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([{ desc: '', qty: 1, price: 0 }])

  const totals = useMemo(() => {
    const subtotal = rows.reduce((n, r) => n + r.qty * r.price, 0)
    const vat = withVat ? subtotal * (VAT / 100) : 0
    return { subtotal, vat, total: subtotal + vat }
  }, [rows, withVat])

  const money = (n: number) =>
    `${n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`

  const title = kind === 'quotation' ? s.quotation : kind === 'proforma' ? s.proforma : s.receipt

  function setRow(i: number, patch: Partial<Row>) {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  return (
    <Stack data-testid="quotation">
      <div className="flex flex-wrap items-center gap-3 print-hide">
        <Seg>
          <SegButton active={kind === 'quotation'} data-testid="qt-quotation" onClick={() => { setKind('quotation'); setNumber('Q-001') }}>{s.quotation}</SegButton>
          <SegButton active={kind === 'proforma'} data-testid="qt-proforma" onClick={() => { setKind('proforma'); setNumber('PF-001') }}>{s.proforma}</SegButton>
          <SegButton active={kind === 'receipt'} data-testid="qt-receipt" onClick={() => { setKind('receipt'); setNumber('R-001') }}>{s.receipt}</SegButton>
        </Seg>
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          {s.currency}
          <Input className="w-20 font-mono" data-testid="qt-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
          <input type="checkbox" checked={withVat} data-testid="qt-vat" className="size-[1.05rem] accent-green-600"
            onChange={(e) => setWithVat(e.target.checked)} /> {s.includeVat}
        </label>
        <Button variant="primary" onClick={() => window.print()} data-testid="qt-print"><ReceiptIcon /> {s.print}</Button>
      </div>

      {/* Reuses the invoice print stylesheet: only .invoice-print survives on paper. */}
      <div className="invoice-print flex flex-col gap-5 border border-[color:var(--line)] rounded-md bg-[var(--surface)] p-5">
        <div className="flex flex-wrap justify-between gap-4 items-start">
          <h1 className="font-display text-[1.8rem] text-ink m-0 rtl:font-ar" data-testid="qt-title">{title}</h1>
          <div className="flex flex-col gap-1 text-[0.85rem] min-w-[12rem]">
            <label className="flex items-center gap-2">
              <span className="text-ink-faint w-24 rtl:font-ar">{s.number}</span>
              <Input className="flex-1 py-1" data-testid="qt-number" value={number} onChange={(e) => setNumber(e.target.value)} />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-ink-faint w-24 rtl:font-ar">{kind === 'receipt' ? s.paidOn : s.date}</span>
              <Input type="date" className="flex-1 py-1" data-testid="qt-date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            {kind !== 'receipt' && (
              <label className="flex items-center gap-2">
                <span className="text-ink-faint w-24 rtl:font-ar">{s.validUntil}</span>
                <Input type="date" className="flex-1 py-1" data-testid="qt-valid" value={valid} onChange={(e) => setValid(e.target.value)} />
              </label>
            )}
            {kind === 'receipt' && (
              <>
                <label className="flex items-center gap-2">
                  <span className="text-ink-faint w-24 rtl:font-ar">{s.method}</span>
                  <Select className="flex-1 py-1" data-testid="qt-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {s.methods.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-ink-faint w-24 rtl:font-ar">{s.reference}</span>
                  <Input className="flex-1 py-1" data-testid="qt-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
                </label>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 min-[560px]:grid-cols-2">
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.from}
            <Textarea rows={4} dir="auto" data-testid="qt-from" placeholder={s.placeholderFrom} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.to}
            <Textarea rows={4} dir="auto" data-testid="qt-to" placeholder={s.placeholderTo} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.items}</span>
          <div className="flex flex-col gap-2" data-testid="qt-rows">
            {rows.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input className="flex-1 min-w-[10rem] py-1" dir="auto" placeholder={s.desc} data-testid={`qt-desc-${i}`}
                  value={r.desc} onChange={(e) => setRow(i, { desc: e.target.value })} />
                <Input type="number" min={0} step="any" dir="ltr" className="w-20 py-1 font-mono" placeholder={s.qty} data-testid={`qt-qty-${i}`}
                  value={r.qty} onChange={(e) => setRow(i, { qty: +e.target.value || 0 })} />
                <Input type="number" min={0} step="any" dir="ltr" className="w-28 py-1 font-mono" placeholder={s.price} data-testid={`qt-price-${i}`}
                  value={r.price} onChange={(e) => setRow(i, { price: +e.target.value || 0 })} />
                <span className="font-mono text-[0.9rem] text-ink w-28 text-end" data-testid={`qt-line-${i}`}>{money(r.qty * r.price)}</span>
                <Button className="px-2 py-1 print-hide" aria-label={s.remove} data-testid={`qt-del-${i}`}
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}><TrashIcon /></Button>
              </div>
            ))}
          </div>
          <Button className="self-start px-3 py-1 print-hide" data-testid="qt-add"
            onClick={() => setRows([...rows, { desc: '', qty: 1, price: 0 }])}>{s.add}</Button>
        </div>

        <div className="flex flex-col items-end gap-1 text-[0.95rem]">
          <span className="flex gap-6"><span className="text-ink-faint rtl:font-ar">{s.subtotal}</span><span className="font-mono text-ink w-32 text-end" data-testid="qt-subtotal">{money(totals.subtotal)}</span></span>
          {withVat && <span className="flex gap-6"><span className="text-ink-faint rtl:font-ar">{s.vat}</span><span className="font-mono text-ink w-32 text-end" data-testid="qt-vatamount">{money(totals.vat)}</span></span>}
          <span className="flex gap-6 font-semibold"><span className="text-ink rtl:font-ar">{s.total}</span><span className="font-mono text-ink w-32 text-end" data-testid="qt-total">{money(totals.total)}</span></span>
        </div>

        {kind === 'receipt' && (
          <p className="font-display text-[1.1rem] text-green-700 rtl:font-ar" data-testid="qt-received">{s.received}</p>
        )}

        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.notes}
          <Textarea rows={3} dir="auto" data-testid="qt-notes" placeholder={s.placeholderNotes} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <p className="text-[0.8rem] text-ink-faint rtl:font-ar" data-testid="qt-disclaimer">
          {kind === 'receipt' ? s.disclaimerR : s.disclaimerQ}
        </p>
      </div>

      <Panel className="print-hide">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">
          {locale === 'ar'
            ? 'يبقى كل ما تكتبه في متصفحك. اطبع الصفحة أو احفظها PDF من مربع الطباعة.'
            : 'Everything you type stays in your browser. Print the page, or choose “Save as PDF” in the print dialog.'}
        </p>
      </Panel>
    </Stack>
  )
}
