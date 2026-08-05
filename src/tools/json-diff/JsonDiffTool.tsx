import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Textarea, Stack, Check, Panel } from '../../components/ui'
import { DiffIcon } from '../../components/icons'
import { diff, parseJson, preview, type Change, type ChangeKind } from './diff'

const STR = {
  en: {
    left: 'Before', right: 'After',
    placeholder: 'Paste JSON…',
    invalid: 'Invalid JSON', ignoreOrder: 'Treat arrays as unordered',
    ignoreHint: 'Right for a list of tags, wrong for a list of steps.',
    identical: 'These two documents hold exactly the same data.',
    reordered: 'The text differs but the data does not — only formatting or key order changed.',
    changes: (n: number) => `${n} difference${n === 1 ? '' : 's'}`,
    kinds: { added: 'added', removed: 'removed', changed: 'changed', type: 'type changed' } as Record<ChangeKind, string>,
    hint: 'Compare two JSON documents by value rather than by line — so reformatting or reordering keys does not drown the one field that actually changed.',
    both: 'Paste JSON into both boxes.',
  },
  ar: {
    left: 'قبل', right: 'بعد',
    placeholder: 'الصق JSON…',
    invalid: 'JSON غير صالح', ignoreOrder: 'تعامل مع المصفوفات كغير مرتّبة',
    ignoreHint: 'مناسب لقائمة وسوم، وغير مناسب لقائمة خطوات.',
    identical: 'يحمل المستندان البيانات نفسها تمامًا.',
    reordered: 'النص مختلف والبيانات لا — تغيّر التنسيق أو ترتيب المفاتيح فقط.',
    changes: (n: number) => `${n.toLocaleString('ar')} اختلافًا`,
    kinds: { added: 'أُضيف', removed: 'حُذف', changed: 'تغيّر', type: 'تغيّر النوع' } as Record<ChangeKind, string>,
    hint: 'قارن مستندَي JSON بالقيمة لا بالسطر — فلا يغرق إعادةُ التنسيق أو ترتيبُ المفاتيح الحقلَ الوحيد الذي تغيّر فعلًا.',
    both: 'الصق JSON في الصندوقين.',
  },
}

const TONE: Record<ChangeKind, string> = {
  added: 'border-green-600',
  removed: 'border-gold-500',
  changed: 'border-[color:var(--line)]',
  type: 'border-gold-500',
}

export default function JsonDiffTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [ignoreOrder, setIgnoreOrder] = useState(false)

  const a = useMemo(() => parseJson(left), [left])
  const b = useMemo(() => parseJson(right), [right])
  const ready = a.value !== undefined && b.value !== undefined && !a.error && !b.error

  const changes: Change[] = useMemo(
    () => (ready ? diff(a.value, b.value, { ignoreArrayOrder: ignoreOrder }) : []),
    [a.value, b.value, ready, ignoreOrder],
  )
  const textDiffers = left.trim() !== right.trim()

  return (
    <Stack data-testid="json-diff">
      <div className="grid gap-3 grid-cols-1 min-[760px]:grid-cols-2">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.left}
          <Textarea className="min-h-[12rem] font-mono text-[0.8rem]" dir="ltr" data-testid="jd-left"
            placeholder={s.placeholder} value={left} onChange={(e) => setLeft(e.target.value)} />
          {a.error && <span className="text-gold-500 text-[0.8rem]" data-testid="jd-left-error">{s.invalid}: {a.error}</span>}
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.right}
          <Textarea className="min-h-[12rem] font-mono text-[0.8rem]" dir="ltr" data-testid="jd-right"
            placeholder={s.placeholder} value={right} onChange={(e) => setRight(e.target.value)} />
          {b.error && <span className="text-gold-500 text-[0.8rem]" data-testid="jd-right-error">{s.invalid}: {b.error}</span>}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Check>
          <input type="checkbox" checked={ignoreOrder} data-testid="jd-order" onChange={(e) => setIgnoreOrder(e.target.checked)} /> {s.ignoreOrder}
        </Check>
        <span className="text-[0.82rem] text-ink-faint rtl:font-ar">{s.ignoreHint}</span>
      </div>

      {!ready ? (
        <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{left || right ? s.both : s.hint}</p>
      ) : changes.length === 0 ? (
        <Panel data-testid="jd-same">
          <p className="text-[0.95rem] text-green-700 rtl:font-ar">{textDiffers ? s.reordered : s.identical}</p>
        </Panel>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <DiffIcon className="text-ink-faint" />
            <span className="text-[0.95rem] font-semibold text-ink rtl:font-ar" data-testid="jd-count">{s.changes(changes.length)}</span>
          </div>
          <div className="flex flex-col gap-2" data-testid="jd-changes">
            {changes.map((c, i) => (
              <div key={i} className={`flex flex-col gap-0.5 border-s-[3px] ps-3 py-1 ${TONE[c.kind]}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[0.85rem] text-ink break-all">{c.path || '(root)'}</span>
                  <span className="font-mono text-[0.7rem] uppercase tracking-[0.06em] text-ink-faint">{s.kinds[c.kind]}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 text-[0.82rem] font-mono">
                  {c.before !== undefined && <span className="text-gold-500">− {preview(c.before)}</span>}
                  {c.after !== undefined && <span className="text-green-700">+ {preview(c.after)}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Stack>
  )
}
