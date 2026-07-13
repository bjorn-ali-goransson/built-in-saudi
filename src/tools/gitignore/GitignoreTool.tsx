import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Button, FieldLabel } from '../../components/ui'
import { CopyIcon, DownloadIcon } from '../../components/icons'

const TEMPLATES: Record<string, string> = {
  Node: 'node_modules/\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\n.pnpm-debug.log*\n.npm/\ndist/\nbuild/\ncoverage/\n.cache/',
  Python: '__pycache__/\n*.py[cod]\n*.egg-info/\n.eggs/\nbuild/\ndist/\n.venv/\nvenv/\nenv/\n.pytest_cache/\n.mypy_cache/\n.ruff_cache/',
  React: '# Vite / CRA\ndist/\nbuild/\n.vite/\n*.local',
  Java: '*.class\ntarget/\n*.jar\n*.war\n.gradle/\nbuild/\n.mvn/',
  Go: '# Binaries\n*.exe\n*.out\n/bin/\nvendor/\n*.test\ncoverage.out',
  Rust: '/target/\nCargo.lock\n**/*.rs.bk',
  'PHP / Laravel': '/vendor/\n/node_modules/\n.env\n/public/storage\n/storage/*.key',
  Env: '.env\n.env.local\n.env.*.local\n*.pem',
  macOS: '.DS_Store\n.AppleDouble\n.LSOverride\n._*\n.Spotlight-V100\n.Trashes',
  Windows: 'Thumbs.db\nehthumbs.db\nDesktop.ini\n$RECYCLE.BIN/\n*.lnk',
  Linux: '*~\n.fuse_hidden*\n.directory\n.Trash-*',
  'VS Code': '.vscode/*\n!.vscode/settings.json\n!.vscode/extensions.json\n*.code-workspace',
  JetBrains: '.idea/\n*.iml\n*.iws\nout/',
}

const STR = {
  en: { pick: 'Select what you use', output: '.gitignore', copy: 'Copy', copied: 'Copied!', download: 'Download', none: 'Select one or more above to build your .gitignore.', privacy: 'Generated in your browser — nothing is uploaded.' },
  ar: { pick: 'اختر ما تستخدمه', output: '.gitignore', copy: 'نسخ', copied: 'تم النسخ!', download: 'تنزيل', none: 'اختر واحدًا أو أكثر أعلاه لبناء ملف .gitignore.', privacy: 'يُولَّد في متصفحك — لا يُرفع أي شيء.' },
}

export default function GitignoreTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [sel, setSel] = useState<Set<string>>(new Set(['Node', 'macOS']))
  const [copied, setCopied] = useState(false)
  const toggle = (k: string) => setSel((cur) => { const n = new Set(cur); n.has(k) ? n.delete(k) : n.add(k); return n })

  const out = useMemo(() => Object.keys(TEMPLATES).filter((k) => sel.has(k)).map((k) => `# ${k}\n${TEMPLATES[k]}`).join('\n\n') + (sel.size ? '\n' : ''), [sel])
  async function copy() { try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }
  const url = useMemo(() => URL.createObjectURL(new Blob([out], { type: 'text/plain' })), [out])

  return (
    <Stack data-testid="gitignore">
      <div>
        <FieldLabel>{s.pick}</FieldLabel>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.keys(TEMPLATES).map((k) => (
            <button key={k} type="button" onClick={() => toggle(k)} data-testid={`gi-${k.replace(/\W+/g, '-').toLowerCase()}`}
              className={`px-3 py-1.5 rounded-md border text-[0.85rem] cursor-pointer ${sel.has(k) ? 'bg-green-600 text-sand-100 border-green-600' : 'bg-[var(--surface)] border-[color:var(--line)] text-ink-soft hover:border-green-500'}`}>{k}</button>
          ))}
        </div>
      </div>

      {sel.size > 0 ? (
        <>
          <div className="flex items-center justify-between"><FieldLabel>{s.output}</FieldLabel>
            <div className="flex gap-2"><Button onClick={copy} data-testid="gi-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
              <Button href={url} download=".gitignore"><DownloadIcon /> {s.download}</Button></div></div>
          <pre className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-3 font-mono text-[0.82rem] overflow-x-auto" dir="ltr" data-testid="gi-output">{out}</pre>
        </>
      ) : <p className="text-[0.9rem] text-ink-faint">{s.none}</p>}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
