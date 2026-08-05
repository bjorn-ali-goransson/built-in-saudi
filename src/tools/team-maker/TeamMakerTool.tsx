import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Textarea, Stack, Seg, SegButton, Panel } from '../../components/ui'
import { UsersIcon, CopyIcon, RefreshIcon } from '../../components/icons'

const STORE = 'bis-team-names'

const STR = {
  en: {
    names: 'Names, one per line', placeholder: 'Ahmed\nFatimah\nKhalid\nNoura\nSalem\nHessa',
    mode: 'Split by', byTeams: 'Number of teams', bySize: 'People per team',
    teams: 'Teams', size: 'Size', make: 'Make teams', again: 'Shuffle again',
    keepApart: 'Keep these apart', keepApartPh: 'ahmed, khalid',
    keepApartHint: 'Comma-separated. They will be placed on different teams where possible — useful for splitting up the two who always end up together.',
    count: (n: number) => `${n} name${n === 1 ? '' : 's'}`,
    team: (n: number) => `Team ${n}`,
    copy: 'Copy', copied: 'Copied!',
    tooFew: 'Add at least two names.',
    uneven: 'The names do not divide evenly, so some teams have one more than others.',
    fair: 'The shuffle uses crypto.getRandomValues, and every arrangement is equally likely — a naive sort-by-random does not give you that.',
    impossible: 'Some of the people you asked to keep apart could not be separated — there are fewer teams than there are of them.',
  },
  ar: {
    names: 'الأسماء، اسم في كل سطر', placeholder: 'أحمد\nفاطمة\nخالد\nنورة\nسالم\nحصة',
    mode: 'قسّم حسب', byTeams: 'عدد الفرق', bySize: 'عدد الأفراد في الفريق',
    teams: 'الفرق', size: 'الحجم', make: 'كوّن الفرق', again: 'اخلط مجددًا',
    keepApart: 'افصل بين هؤلاء', keepApartPh: 'أحمد، خالد',
    keepApartHint: 'مفصولة بفواصل. سيُوضعون في فرق مختلفة قدر الإمكان — مفيد لتفريق الاثنين اللذين ينتهيان معًا دائمًا.',
    count: (n: number) => `${n.toLocaleString('ar')} اسمًا`,
    team: (n: number) => `الفريق ${n.toLocaleString('ar')}`,
    copy: 'نسخ', copied: 'تم النسخ!',
    tooFew: 'أضف اسمين على الأقل.',
    uneven: 'لا تنقسم الأسماء بالتساوي، لذا تزيد بعض الفرق فردًا عن غيرها.',
    fair: 'يستخدم الخلط crypto.getRandomValues، وكل ترتيب محتمل بالتساوي — وهو ما لا يمنحك إياه الترتيب العشوائي الساذج.',
    impossible: 'تعذّر فصل بعض من طلبت إبعادهم عن بعض — عدد الفرق أقل من عددهم.',
  },
}

/** Fisher-Yates with crypto randomness. A .sort(() => Math.random() - 0.5) is
 *  the common shortcut and it is measurably biased — some orders come up far
 *  more often than others, which for a team draw is exactly what you must not do. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const limit = Math.floor(0xffffffff / (i + 1)) * (i + 1)
    const buf = new Uint32Array(1)
    let v = 0
    do { crypto.getRandomValues(buf); v = buf[0] } while (v >= limit)
    const j = v % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function TeamMakerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('')
  const [mode, setMode] = useState<'teams' | 'size'>('teams')
  const [teams, setTeams] = useState(2)
  const [size, setSize] = useState(3)
  const [apart, setApart] = useState('')
  const [nonce, setNonce] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => { try { setRaw(localStorage.getItem(STORE) ?? '') } catch { /* ignore */ } }, [])
  useEffect(() => { try { localStorage.setItem(STORE, raw) } catch { /* ignore */ } }, [raw])

  const names = useMemo(() => raw.split('\n').map((l) => l.trim()).filter(Boolean), [raw])

  const result = useMemo(() => {
    void nonce // re-shuffle when asked
    if (names.length < 2) return { groups: [] as string[][], impossible: false }
    const groupCount = mode === 'teams'
      ? Math.max(1, Math.min(teams, names.length))
      : Math.max(1, Math.ceil(names.length / Math.max(1, size)))

    const keepApart = apart.split(/[,،]/).map((x) => x.trim().toLowerCase()).filter(Boolean)
    const special = names.filter((n) => keepApart.includes(n.toLowerCase()))
    const rest = shuffle(names.filter((n) => !keepApart.includes(n.toLowerCase())))

    const groups: string[][] = Array.from({ length: groupCount }, () => [])
    // Seed one "keep apart" person per team first, so they cannot land together.
    const seeded = shuffle(special)
    seeded.forEach((n, i) => { if (i < groupCount) groups[i].push(n) })
    const overflow = seeded.slice(groupCount)
    // Deal the rest round-robin, which keeps the sizes within one of each other.
    ;[...rest, ...overflow].forEach((n, i) => {
      const target = groups.reduce((best, g, gi) => (g.length < groups[best].length ? gi : best), 0)
      groups[target].push(n)
      void i
    })
    return { groups, impossible: overflow.length > 0 }
  }, [names, mode, teams, size, apart, nonce])

  const uneven = result.groups.length > 1
    && new Set(result.groups.map((g) => g.length)).size > 1

  const asText = result.groups
    .map((g, i) => `${s.team(i + 1)}\n${g.map((n) => `  ${n}`).join('\n')}`)
    .join('\n\n')

  async function copy() {
    try { await navigator.clipboard.writeText(asText); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="team-maker">
      <div className="flex flex-col min-[760px]:flex-row gap-5">
        <div className="flex flex-col gap-2 min-[760px]:w-[18rem]">
          <label className="text-[0.8rem] text-ink-faint">{s.names}</label>
          <Textarea className="min-h-[12rem]" dir="auto" data-testid="tm-names"
            placeholder={s.placeholder} value={raw} onChange={(e) => setRaw(e.target.value)} />
          <span className="text-[0.9rem] text-ink-faint" data-testid="tm-count">{s.count(names.length)}</span>

          <div className="flex flex-col gap-1">
            <span className="text-[0.8rem] text-ink-faint">{s.mode}</span>
            <Seg>
              <SegButton active={mode === 'teams'} data-testid="tm-mode-teams" onClick={() => setMode('teams')}>{s.byTeams}</SegButton>
              <SegButton active={mode === 'size'} data-testid="tm-mode-size" onClick={() => setMode('size')}>{s.bySize}</SegButton>
            </Seg>
          </div>
          <Input type="number" min={1} max={50} dir="ltr" className="w-24 font-mono"
            data-testid="tm-number"
            value={mode === 'teams' ? teams : size}
            onChange={(e) => {
              const v = Math.max(1, Math.min(50, +e.target.value || 1))
              if (mode === 'teams') setTeams(v); else setSize(v)
            }} />

          <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
            {s.keepApart}
            <Input dir="auto" data-testid="tm-apart" placeholder={s.keepApartPh}
              value={apart} onChange={(e) => setApart(e.target.value)} />
          </label>
          <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.keepApartHint}</span>
        </div>

        <div className="flex flex-col gap-3 flex-1">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setNonce((n) => n + 1)} disabled={names.length < 2} data-testid="tm-make">
              <RefreshIcon /> {result.groups.length ? s.again : s.make}
            </Button>
            {result.groups.length > 0 && (
              <Button onClick={copy} data-testid="tm-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            )}
          </div>

          {names.length < 2 ? (
            <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="tm-toofew">{s.tooFew}</p>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-1 min-[520px]:grid-cols-2 min-[900px]:grid-cols-3" data-testid="tm-teams">
                {result.groups.map((g, i) => (
                  <div key={i} className="flex flex-col gap-1 border border-[color:var(--line)] rounded-md bg-[var(--surface)] p-3">
                    <span className="flex items-center gap-2 font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">
                      <UsersIcon /> {s.team(i + 1)} · {g.length}
                    </span>
                    <ul className="flex flex-col gap-0.5">
                      {g.map((n, j) => <li key={j} className="text-[0.95rem] text-ink rtl:font-ar">{n}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              {uneven && <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="tm-uneven">{s.uneven}</p>}
              {result.impossible && <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="tm-impossible">{s.impossible}</p>}
            </>
          )}
        </div>
      </div>

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.fair}</p></Panel>
    </Stack>
  )
}
