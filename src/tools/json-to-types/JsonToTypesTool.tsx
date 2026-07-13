import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, Button, FieldLabel } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

const STR = {
  en: { input: 'JSON', output: 'TypeScript', rootName: 'Root name', copy: 'Copy', copied: 'Copied!', invalid: 'Invalid JSON — check for a stray comma or quote.', privacy: 'Generated in your browser — nothing is uploaded.' },
  ar: { input: 'JSON', output: 'TypeScript', rootName: 'اسم الجذر', copy: 'نسخ', copied: 'تم النسخ!', invalid: 'JSON غير صالح — تحقّق من فاصلة أو اقتباس زائد.', privacy: 'يُولَّد في متصفحك — لا يُرفع أي شيء.' },
}

type JSONValue = string | number | boolean | null | JSONValue[] | { [k: string]: JSONValue }

const pascal = (s: string) => (s.replace(/(^|[^a-zA-Z0-9])([a-zA-Z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '') || 'Item')
const singular = (s: string) => s.replace(/ies$/, 'y').replace(/s$/, '')
const safeKey = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k))

function generate(root: JSONValue, rootName: string): string {
  const interfaces: string[] = []
  const seen = new Set<string>()

  function uniqueName(base: string): string {
    let name = base || 'Item', i = 2
    while (seen.has(name)) name = `${base}${i++}`
    seen.add(name); return name
  }

  function mergeKeys(items: Record<string, JSONValue>[]): { key: string; type: string; optional: boolean }[] {
    const all = new Set<string>(); items.forEach((o) => Object.keys(o).forEach((k) => all.add(k)))
    return [...all].map((key) => ({
      key,
      type: typeOf(items.find((o) => o[key] !== undefined)?.[key] ?? null, key),
      optional: items.some((o) => o[key] === undefined),
    }))
  }

  function objectInterface(obj: Record<string, JSONValue>, name: string): string {
    const iname = uniqueName(pascal(name))
    const fields = mergeKeys([obj])
    const body = fields.map((f) => `  ${safeKey(f.key)}${f.optional ? '?' : ''}: ${f.type};`).join('\n')
    interfaces.push(`interface ${iname} {\n${body}\n}`)
    return iname
  }

  function typeOf(v: JSONValue, name: string): string {
    if (v === null) return 'null'
    if (Array.isArray(v)) {
      if (!v.length) return 'unknown[]'
      if (v.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x))) {
        const iname = uniqueName(pascal(singular(name)))
        const fields = mergeKeys(v as Record<string, JSONValue>[])
        const body = fields.map((f) => `  ${safeKey(f.key)}${f.optional ? '?' : ''}: ${f.type};`).join('\n')
        interfaces.push(`interface ${iname} {\n${body}\n}`)
        return `${iname}[]`
      }
      const types = [...new Set(v.map((x) => typeOf(x, singular(name))))]
      return types.length === 1 ? `${wrap(types[0])}[]` : `(${types.join(' | ')})[]`
    }
    if (typeof v === 'object') return objectInterface(v as Record<string, JSONValue>, name)
    return typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string'
  }
  const wrap = (t: string) => (/[ |]/.test(t) ? `(${t})` : t)

  const rootType = typeOf(root, rootName)
  // If the root wasn't an object/array-of-objects, emit a type alias.
  if (!interfaces.some((i) => i.startsWith(`interface ${pascal(rootName)} `)) && !rootType.startsWith(pascal(rootName)))
    interfaces.unshift(`type ${pascal(rootName)} = ${rootType};`)
  // interfaces were pushed innermost-first via recursion order; reverse for root-first reading
  return interfaces.reverse().join('\n\n')
}

export default function JsonToTypesTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [input, setInput] = useState('{\n  "id": 1,\n  "name": "Sara",\n  "tags": ["a", "b"],\n  "address": { "city": "Riyadh", "zip": "12345" }\n}')
  const [rootName] = useState('Root')
  const [copied, setCopied] = useState(false)

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: '' }
    try { return { output: generate(JSON.parse(input), rootName || 'Root'), error: '' } }
    catch { return { output: '', error: s.invalid } }
  }, [input, rootName, s])

  async function copy() { try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }

  return (
    <Stack data-testid="json-to-types">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input}</FieldLabel>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={12} dir="ltr" className="font-mono text-[0.82rem]" data-testid="jt-input" /></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.output}</FieldLabel>
          <Textarea value={error || output} readOnly rows={12} dir="ltr" className={`font-mono text-[0.82rem] ${error ? 'text-[color:var(--danger)]' : ''}`} data-testid="jt-output" /></label>
      </div>
      <Button onClick={copy} disabled={!output} className="self-start" data-testid="jt-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
