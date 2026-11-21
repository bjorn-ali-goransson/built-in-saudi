import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLocale } from '../../i18n'
import { Button, Input, Field, Panel, Stack, StackActions, Spinner, Sheet, SheetTitle, SheetActions } from '../../components/ui'
import { BellIcon, CopyIcon, ShareIcon, TrashIcon, UserPlusIcon, CheckIcon, KeyIcon } from '../../components/icons'
import { setWorkInProgress } from '../../lib/workInProgress'
import { pushSupported, subscribeDevice, currentSubscription } from '../../lib/push'
import { passkeySupported, passkeyCancelled } from '../../lib/passkey'
import {
  ApiError, SESSION_EVENT, loadSession, saveSession, signUp, signIn, localZone,
  createPoll, getPoll, claimName, setAvail, invite, removePerson, deletePoll, subscribe, unsubscribe,
  myData, deleteAccount, type Poll, type Session, type MyData,
} from './api'
import { WeekGrid } from './WeekGrid'
import { layout, tally, everyone as everyoneOf, best as bestOf, runs, slotTime, loadRecent, rememberPoll, forgetPoll, loadPushed, setPushed } from './lib'

const STR = {
  en: {
    newTitle: 'Find a time that suits everyone',
    newBody: 'Name the meeting and the people you are inviting. You get one link to send them; each of them marks when they are free, and everybody sees the times that suit the whole group, live.',
    title: 'What is it for?', titlePh: 'Project kick-off', yourName: 'Your name', yourNamePh: 'Your name as the others will see it',
    invitees: 'Who are you inviting?', inviteePh: 'A name, then Enter', add: 'Add',
    create: 'Create and get the link', creating: 'Creating…',
    recent: 'Polls you opened in this browser',
    passkeyWhy: 'You sign in with a passkey (your face, fingerprint or screen lock). No password or email, and only you can change your answer.',
    noPasskey: 'This browser cannot use passkeys. Try an up-to-date Chrome, Safari, Edge or Firefox.',
    by: (n: string) => `Organised by ${n}`,
    yourZone: (z: string) => `Times are shown in your time zone, ${z}.`,
    theirZone: (z: string) => `The organiser is in ${z}.`,
    share: 'Send this link to the people you invited', copy: 'Copy', copied: 'Copied', shareBtn: 'Share',
    who: 'Which one are you?', whoBody: 'Pick your name to mark the times you are free.', notListed: 'I’m not on the list', notListedPh: 'Your name', join: 'Join',
    already: 'Answered on another device?', signInBtn: 'Sign in with your passkey',
    mark: 'Drag across the times you are free. Drag over marked times to clear them. You can mark as many blocks as you like.',
    look: 'Tap a time to see who is free then.',
    mineLegend: 'Your times', freeLegend: 'Others free (darker = more)', everyoneLegend: 'Suits everyone', pastLegend: 'Past',
    saving: 'Saving…', saved: 'Saved',
    focusFree: 'Free', focusNot: 'Not free', nobody: 'nobody yet',
    suits: 'Times that suit everyone who answered', suitsNone: 'No time suits everyone yet.',
    bestSoFar: (n: number, of: number) => `Best so far: ${n} of ${of} free`,
    waitTwo: 'Once two people have answered, the times that suit everyone show here.',
    people: 'Invited', answered: 'Answered', waiting: 'Not answered yet', notJoined: 'Hasn’t opened the link yet', you: 'you', organiser: 'organiser',
    addPeople: 'Invite more people', remove: 'Remove',
    notify: 'Notify me when the best times change', notifyOn: 'Notifications on for this poll', notifyOff: 'Turn off', notifyDenied: 'Notifications are blocked for this site in your browser settings.', notifyNo: 'This browser cannot show notifications.',
    signedIn: (n: string) => `Signed in as ${n}`, signOut: 'Sign out', yourData: 'Your data',
    deletePoll: 'Delete this poll', deleteTitle: 'Delete this poll for everyone?', deleteBody: 'The link stops working and every answer is gone.', cancel: 'Cancel', confirmDelete: 'Delete',
    authTitle: 'Hold your name with a passkey', authBody: 'So that only you can mark or change your times. Your device asks for your face, fingerprint or screen lock; we keep only a public key, never a password or email.',
    authName: 'Your name', createKey: 'Create a passkey', haveKey: 'I already have a passkey',
    missing: 'This poll does not exist any more. Polls are deleted a month after they are made.', startNew: 'Start a new one',
    expires: (d: string) => `Deleted on ${d}, a month after it was made.`,
    dataTitle: 'What we keep for you', dataBody: 'Your name, the public half of each passkey, and the polls you made or answered. Everything is deleted after a month.',
    dataPolls: 'Polls', dataKeys: 'Passkeys', dataOwner: 'yours', dataSlots: (n: number) => `${n} half-hours marked`,
    deleteAll: 'Delete everything', deleteAllDone: 'Deleted. Remove the passkey from your device’s password manager too if you like.', close: 'Close',
    taken: 'Somebody already holds that name. Pick another, or sign in if it is yours.', nameTaken: 'That name is already on the list.',
    err: 'Something went wrong. Try again.', open: 'Open',
  },
  ar: {
    newTitle: 'ابحث عن موعد يناسب الجميع',
    newBody: 'سمِّ الاجتماع ومن تدعوهم. تحصل على رابط واحد ترسله لهم؛ يحدّد كلٌّ منهم أوقات فراغه، ويرى الجميع الأوقات التي تناسب المجموعة كلها مباشرةً.',
    title: 'ما الموعد؟', titlePh: 'اجتماع انطلاق المشروع', yourName: 'اسمك', yourNamePh: 'اسمك كما سيراه الآخرون',
    invitees: 'من تدعو؟', inviteePh: 'اكتب اسمًا ثم Enter', add: 'أضِف',
    create: 'أنشئ واحصل على الرابط', creating: 'جارٍ الإنشاء…',
    recent: 'استطلاعات فتحتها في هذا المتصفح',
    passkeyWhy: 'تسجّل الدخول بمفتاح مرور (وجهك أو بصمتك أو قفل الشاشة). بلا كلمة مرور ولا بريد، ولا يغيّر إجابتك أحد سواك.',
    noPasskey: 'هذا المتصفح لا يدعم مفاتيح المرور. جرّب إصدارًا حديثًا من كروم أو سفاري أو إيدج أو فايرفوكس.',
    by: (n: string) => `المنظّم: ${n}`,
    yourZone: (z: string) => `الأوقات معروضة بتوقيتك، ${z}.`,
    theirZone: (z: string) => `المنظّم في ${z}.`,
    share: 'أرسل هذا الرابط لمن دعوتهم', copy: 'نسخ', copied: 'نُسخ', shareBtn: 'مشاركة',
    who: 'من أنت منهم؟', whoBody: 'اختر اسمك لتحدّد أوقات فراغك.', notListed: 'اسمي ليس في القائمة', notListedPh: 'اسمك', join: 'انضم',
    already: 'أجبت من جهاز آخر؟', signInBtn: 'سجّل الدخول بمفتاح المرور',
    mark: 'اسحب على الأوقات التي تكون فيها متفرغًا. واسحب على المحدَّد لتمسحه. حدّد ما شئت من الفترات.',
    look: 'المس وقتًا لترى من المتفرغ فيه.',
    mineLegend: 'أوقاتك', freeLegend: 'متفرغون آخرون (الأغمق أكثر)', everyoneLegend: 'يناسب الجميع', pastLegend: 'مضى',
    saving: 'جارٍ الحفظ…', saved: 'حُفظ',
    focusFree: 'متفرغ', focusNot: 'غير متفرغ', nobody: 'لا أحد بعد',
    suits: 'أوقات تناسب كل من أجاب', suitsNone: 'لا وقت يناسب الجميع بعد.',
    bestSoFar: (n: number, of: number) => `الأفضل حتى الآن: ${n} من ${of} متفرغون`,
    waitTwo: 'حين يجيب شخصان تظهر هنا الأوقات التي تناسب الجميع.',
    people: 'المدعوون', answered: 'أجاب', waiting: 'لم يُجب بعد', notJoined: 'لم يفتح الرابط بعد', you: 'أنت', organiser: 'المنظّم',
    addPeople: 'ادعُ آخرين', remove: 'إزالة',
    notify: 'نبّهني حين تتغير أفضل الأوقات', notifyOn: 'التنبيهات مفعّلة لهذا الاستطلاع', notifyOff: 'إيقاف', notifyDenied: 'التنبيهات محظورة لهذا الموقع في إعدادات متصفحك.', notifyNo: 'هذا المتصفح لا يعرض التنبيهات.',
    signedIn: (n: string) => `مسجَّل الدخول باسم ${n}`, signOut: 'تسجيل الخروج', yourData: 'بياناتك',
    deletePoll: 'احذف هذا الاستطلاع', deleteTitle: 'حذف الاستطلاع للجميع؟', deleteBody: 'يتوقف الرابط عن العمل وتُحذف كل الإجابات.', cancel: 'إلغاء', confirmDelete: 'حذف',
    authTitle: 'احجز اسمك بمفتاح مرور', authBody: 'حتى لا يحدّد أوقاتك أو يغيّرها أحد سواك. يطلب جهازك وجهك أو بصمتك أو قفل الشاشة؛ ولا نحتفظ إلا بمفتاح عام، لا كلمة مرور ولا بريد.',
    authName: 'اسمك', createKey: 'أنشئ مفتاح مرور', haveKey: 'لديّ مفتاح مرور',
    missing: 'هذا الاستطلاع لم يعد موجودًا. تُحذف الاستطلاعات بعد شهر من إنشائها.', startNew: 'ابدأ استطلاعًا جديدًا',
    expires: (d: string) => `يُحذف في ${d}، بعد شهر من إنشائه.`,
    dataTitle: 'ما نحتفظ به عنك', dataBody: 'اسمك، والنصف العام من كل مفتاح مرور، والاستطلاعات التي أنشأتها أو أجبت فيها. يُحذف كل ذلك بعد شهر.',
    dataPolls: 'الاستطلاعات', dataKeys: 'مفاتيح المرور', dataOwner: 'لك', dataSlots: (n: number) => `${n} نصف ساعة محدَّدة`,
    deleteAll: 'احذف كل شيء', deleteAllDone: 'حُذف. ويمكنك أيضًا إزالة مفتاح المرور من مدير كلمات المرور في جهازك.', close: 'إغلاق',
    taken: 'هذا الاسم محجوز لشخص آخر. اختر غيره، أو سجّل الدخول إن كان لك.', nameTaken: 'هذا الاسم موجود في القائمة.',
    err: 'حدث خطأ ما. حاول مجددًا.', open: 'افتح',
  },
}

type Intent = { kind: 'create' } | { kind: 'claim'; pid?: string; name?: string } | { kind: 'signin' }

export default function FindTimeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const intl = locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB'
  const [params, setParams] = useSearchParams()
  const code = (params.get('p') || '').trim()

  const [session, setSession] = useState<Session | null>(() => loadSession())
  useEffect(() => {
    const on = () => setSession(loadSession())
    window.addEventListener(SESSION_EVENT, on)
    window.addEventListener('storage', on)
    return () => { window.removeEventListener(SESSION_EVENT, on); window.removeEventListener('storage', on) }
  }, [])

  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [auth, setAuth] = useState<Intent | null>(null)
  const [authName, setAuthName] = useState('')
  // The session the data sheet was opened with: it outlives a deletion that
  // signs this browser out, so the sheet can say it is done.
  const [dataFor, setDataFor] = useState<Session | null>(null)

  function fail(e: unknown) {
    if (passkeyCancelled(e)) return
    if (e instanceof ApiError) {
      if (e.message === 'somebody already holds that name') return setErr(s.taken)
      if (e.message === 'that name is taken') return setErr(s.nameTaken)
      if (e.status === 401) { saveSession(null) }
    }
    setErr(s.err)
  }

  /** Signs in (or up) as the intent needs, then does what was asked. */
  const pending = useRef<((sess: Session) => Promise<void>) | null>(null)
  async function withSession(intent: Intent, name: string, then: (sess: Session) => Promise<void>) {
    if (session) return then(session)
    pending.current = then
    setAuthName(name)
    setAuth(intent)
  }
  async function runAuth(make: boolean) {
    setErr(''); setBusy(true)
    try {
      const sess = make ? await signUp(authName.trim()) : await signIn()
      setSession(sess)
      setAuth(null)
      const then = pending.current
      pending.current = null
      if (then) await then(sess)
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const body = code
    ? <PollView key={code} code={code} s={s} intl={intl} locale={locale} session={session} withSession={withSession} fail={fail} setErr={setErr}
        onGone={() => setParams({}, { replace: true })} />
    : <NewPoll s={s} intl={intl} session={session} withSession={withSession} fail={fail} setErr={setErr}
        onCreated={(c) => setParams({ p: c })} />

  return (
    <Stack>
      {err && (
        <div role="alert" data-testid="ft-error" className="rounded-md border border-[color:var(--line)] bg-[color-mix(in_srgb,var(--gold-500)_14%,var(--surface))] px-3 py-2 text-[0.9rem]">
          {err}
        </div>
      )}
      {body}
      <div className="flex flex-wrap items-center gap-3 text-[0.85rem] text-ink-soft">
        {session && <span data-testid="ft-signed-in">{s.signedIn(session.name)}</span>}
        {session && <button type="button" className="underline" onClick={() => setDataFor(session)}>{s.yourData}</button>}
        {session && <button type="button" className="underline" onClick={() => saveSession(null)}>{s.signOut}</button>}
      </div>

      {auth && (
        <Sheet onClose={() => { setAuth(null); pending.current = null }} data-testid="ft-auth">
          <SheetTitle>{s.authTitle}</SheetTitle>
          <p className="text-[0.92rem] text-ink-soft">{s.authBody}</p>
          {!passkeySupported() ? <p>{s.noPasskey}</p> : (
            <Stack>
              {auth.kind !== 'signin' && (
                <Field label={s.authName}>
                  <Input value={authName} maxLength={40} onChange={(e) => setAuthName(e.target.value)} data-testid="ft-auth-name" />
                </Field>
              )}
              <StackActions>
                {auth.kind !== 'signin' && (
                  <Button variant="primary" disabled={busy || !authName.trim()} onClick={() => runAuth(true)} data-testid="ft-create-key">
                    <KeyIcon />{s.createKey}
                  </Button>
                )}
                <Button disabled={busy} onClick={() => runAuth(false)} data-testid="ft-have-key">{s.haveKey}</Button>
                {busy && <Spinner />}
              </StackActions>
            </Stack>
          )}
          <SheetActions>
            <Button onClick={() => { setAuth(null); pending.current = null }}>{s.cancel}</Button>
          </SheetActions>
        </Sheet>
      )}

      {dataFor && <YourData s={s} intl={intl} session={dataFor} onClose={() => setDataFor(null)} />}
    </Stack>
  )
}

type S = (typeof STR)['en']
type WithSession = (intent: Intent, name: string, then: (sess: Session) => Promise<void>) => Promise<void>

function NewPoll({ s, intl, session, withSession, fail, setErr, onCreated }: {
  s: S; intl: string; session: Session | null; withSession: WithSession; fail: (e: unknown) => void; setErr: (m: string) => void; onCreated: (code: string) => void
}) {
  const [title, setTitle] = useState('')
  const [name, setName] = useState(session?.name || '')
  const [draft, setDraft] = useState('')
  const [names, setNames] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const recent = useMemo(() => loadRecent(), [])
  const dateFmt = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short' })

  function addName() {
    const n = draft.trim()
    if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) setNames([...names, n])
    setDraft('')
  }

  async function create() {
    setErr('')
    const all = draft.trim() ? [...names, draft.trim()] : names
    setDraft(''); setNames(all)
    await withSession({ kind: 'create' }, name, async (sess) => {
      setBusy(true)
      try {
        const p = await createPoll(sess.token, title, all)
        rememberPoll(p.code, p.title, p.expiresAt)
        onCreated(p.code)
      } catch (e) { fail(e) } finally { setBusy(false) }
    })
  }

  return (
    <>
      <Panel>
        <div className="grid gap-1">
          <h2 className="text-[1.15rem] font-bold">{s.newTitle}</h2>
          <p className="text-[0.92rem] text-ink-soft">{s.newBody}</p>
        </div>
        <Field label={s.title}>
          <Input value={title} maxLength={80} placeholder={s.titlePh} onChange={(e) => setTitle(e.target.value)} data-testid="ft-title" />
        </Field>
        {!session && (
          <Field label={s.yourName}>
            <Input value={name} maxLength={40} placeholder={s.yourNamePh} onChange={(e) => setName(e.target.value)} data-testid="ft-your-name" />
          </Field>
        )}
        <div className="grid gap-2">
          <Field label={s.invitees}>
            <div className="flex gap-2">
              <Input value={draft} maxLength={40} placeholder={s.inviteePh} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addName() } }}
                data-testid="ft-invitee" className="flex-1" />
              <Button type="button" onClick={addName} data-testid="ft-add-invitee"><UserPlusIcon />{s.add}</Button>
            </div>
          </Field>
          {names.length > 0 && (
            <ul className="flex flex-wrap gap-2" data-testid="ft-invitees">
              {names.map((n) => (
                <li key={n} className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] bg-[var(--surface)] ps-3 pe-1 py-0.5 text-[0.88rem]">
                  {n}
                  <button type="button" aria-label={`${s.remove} ${n}`} className="grid size-6 place-items-center rounded-full hover:bg-[var(--line-soft)]" onClick={() => setNames(names.filter((x) => x !== n))}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <StackActions className="items-center">
          <Button variant="primary" disabled={busy || (!session && !name.trim())} onClick={create} data-testid="ft-create">
            {busy ? s.creating : s.create}
          </Button>
          {busy && <Spinner />}
        </StackActions>
        <p className="text-[0.82rem] text-ink-faint">{passkeySupported() ? s.passkeyWhy : s.noPasskey}</p>
      </Panel>
      {recent.length > 0 && (
        <Panel>
          <h3 className="font-semibold">{s.recent}</h3>
          <ul className="grid gap-1.5">
            {recent.map((r) => (
              <li key={r.code} className="flex items-center justify-between gap-3">
                <span className="truncate">{r.title || r.code}</span>
                <span className="flex items-center gap-3 text-[0.82rem] text-ink-faint">
                  {dateFmt.format(r.at)}
                  <Button to={`?p=${r.code}`} className="!py-1 !px-3">{s.open}</Button>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}

function PollView({ code, s, intl, locale, session, withSession, fail, setErr, onGone }: {
  code: string; s: S; intl: string; locale: string; session: Session | null; withSession: WithSession
  fail: (e: unknown) => void; setErr: (m: string) => void; onGone: () => void
}) {
  const [poll, setPoll] = useState<Poll | null>(null)
  const [missing, setMissing] = useState(false)
  const [mine, setMine] = useState<Set<number> | null>(null)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [focus, setFocus] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [other, setOther] = useState('')
  const [more, setMore] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const dirty = useRef(0) // edits not yet answered by the server
  const version = useRef<number | undefined>(undefined)
  const token = session?.token

  // A server answer is the truth, except for my marks while a save is in flight.
  const apply = useCallback((p: Poll) => {
    version.current = p.version
    setPoll(p)
    rememberPoll(p.code, p.title, p.expiresAt)
    const me = p.people.find((x) => x.you)
    if (!me) setMine(null)
    else if (dirty.current === 0) setMine(new Set(me.avail))
  }, [])

  // Live: ask for the version we have; the server answers `unchanged` for the
  // price of one read. Faster while the page is looked at.
  useEffect(() => {
    let stop = false
    let timer = 0
    version.current = undefined
    async function tick() {
      try {
        const r = await getPoll(code, token, version.current)
        if (stop) return
        if (r.exists === false) { setMissing(true); return }
        if (r.poll) apply(r.poll)
      } catch { /* offline for a moment: try again on the next tick */ }
      if (!stop) timer = window.setTimeout(tick, document.visibilityState === 'visible' ? 3000 : 20000)
    }
    tick()
    const wake = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); tick() } }
    document.addEventListener('visibilitychange', wake)
    return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', wake) }
  }, [code, token, apply])

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t) }, [])
  useEffect(() => () => setWorkInProgress('find-time', false), [])

  const lay = useMemo(() => (poll ? layout(poll.start, poll.days, poll.slotMin) : null), [poll?.start, poll?.days, poll?.slotMin]) // eslint-disable-line react-hooks/exhaustive-deps
  const { free, answered } = useMemo(() => (poll ? tally(poll.people, mine) : { free: new Map<number, string[]>(), answered: 0 }), [poll, mine])
  const all = useMemo(() => everyoneOf(free, answered), [free, answered])
  const allSet = useMemo(() => new Set(all), [all])
  const best = useMemo(() => bestOf(free), [free])

  if (missing) {
    return (
      <Panel data-testid="ft-missing">
        <p>{s.missing}</p>
        <StackActions><Button variant="primary" onClick={() => { forgetPoll(code); onGone() }}>{s.startNew}</Button></StackActions>
      </Panel>
    )
  }
  if (!poll || !lay) return <div className="grid place-items-center py-10"><Spinner /></div>

  const me = poll.people.find((x) => x.you)
  const organiser = poll.people.find((x) => x.owner)
  const zone = localZone()
  const link = `${location.origin}${location.pathname}?p=${poll.code}`
  const dayFmt = new Intl.DateTimeFormat(intl, { weekday: 'long', day: 'numeric', month: 'long' })
  const timeFmt = new Intl.DateTimeFormat(intl, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const t0 = (i: number) => slotTime(poll.start, poll.slotMin, i)
  const range = (a: number, b: number) => `${dayFmt.format(t0(a))} · ${timeFmt.format(t0(a))}–${timeFmt.format(t0(b) + poll.slotMin * 60000)}`

  async function save(next: Set<number>) {
    if (!token || !poll) return
    setMine(next)
    const seq = ++dirty.current
    setSaving('saving')
    setWorkInProgress('find-time', true)
    try {
      const p = await setAvail(token, poll.code, [...next])
      if (seq === dirty.current) { dirty.current = 0; apply(p); setSaving('saved'); setWorkInProgress('find-time', false) }
    } catch (e) { dirty.current = 0; setSaving('idle'); setWorkInProgress('find-time', false); fail(e) }
  }

  function claim(which: { pid?: string; name?: string }, name: string) {
    setErr('')
    return withSession({ kind: 'claim', ...which }, name, async (sess) => {
      try { apply(await claimName(sess.token, code, which)) } catch (e) { fail(e) }
    })
  }

  async function addMore() {
    const names = more.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean)
    if (!names.length || !token) return
    setMore('')
    try { apply(await invite(token, code, names)) } catch (e) { fail(e) }
  }

  async function share() {
    const text = poll!.title || s.newTitle
    if (navigator.share) { try { await navigator.share({ title: text, url: link }); return } catch { /* fell back to copy */ } }
    copy()
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* the field is selectable */ }
  }

  const focusNames = focus != null ? free.get(focus) || [] : []
  const focusNot = focus != null ? poll.people.filter((p) => (p.you ? mine?.size || p.answered : p.answered) && !focusNames.includes(p.name)).map((p) => p.name) : []
  const unclaimed = poll.people.filter((p) => !p.claimed)

  return (
    <>
      <Panel>
        <div className="grid gap-1">
          <h2 className="text-[1.25rem] font-bold" data-testid="ft-poll-title">{poll.title || s.newTitle}</h2>
          {organiser && <p className="text-[0.9rem] text-ink-soft">{s.by(organiser.name)}</p>}
          <p className="text-[0.85rem] text-ink-faint" data-testid="ft-zone">
            {s.yourZone(zone)}{poll.tz && poll.tz !== zone ? ` ${s.theirZone(poll.tz)}` : ''}
          </p>
        </div>
        <div className="grid gap-1.5">
          <span className="text-[0.82rem] font-semibold text-ink-soft">{s.share}</span>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-[14rem] font-mono text-[0.85rem]" data-testid="ft-link" dir="ltr" />
            <Button onClick={copy} data-testid="ft-copy">{copied ? <CheckIcon /> : <CopyIcon />}{copied ? s.copied : s.copy}</Button>
            {typeof navigator.share === 'function' && <Button onClick={share}><ShareIcon />{s.shareBtn}</Button>}
          </div>
        </div>
      </Panel>

      {!me && (
        <Panel data-testid="ft-who">
          <div className="grid gap-1">
            <h3 className="font-semibold">{s.who}</h3>
            <p className="text-[0.9rem] text-ink-soft">{s.whoBody}</p>
          </div>
          {unclaimed.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {unclaimed.map((p) => (
                <Button key={p.id} onClick={() => claim({ pid: p.id }, p.name)} data-testid={`ft-iam-${p.name}`}>{p.name}</Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Input value={other} maxLength={40} placeholder={s.notListedPh} onChange={(e) => setOther(e.target.value)} className="flex-1 min-w-[12rem]" aria-label={s.notListed} data-testid="ft-other-name" />
            <Button disabled={!other.trim()} onClick={() => claim({ name: other.trim() }, other.trim())} data-testid="ft-join">{s.notListed}: {s.join}</Button>
          </div>
          {!session && (
            <p className="text-[0.85rem] text-ink-soft">
              {s.already}{' '}
              <button type="button" className="underline" onClick={() => withSession({ kind: 'signin' }, '', async () => { /* the live poll re-reads with the new session */ })} data-testid="ft-signin">{s.signInBtn}</button>
            </p>
          )}
        </Panel>
      )}

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.9rem] text-ink-soft">{me ? s.mark : s.look}</p>
          {me && saving !== 'idle' && <span className="text-[0.82rem] text-ink-faint" data-testid="ft-saving">{saving === 'saving' ? s.saving : s.saved}</span>}
        </div>
        <WeekGrid
          lay={lay} start={poll.start} slotMin={poll.slotMin} now={now}
          free={free} answered={answered} everyone={allSet}
          mine={me ? mine || new Set() : null} onCommit={save}
          focus={focus} onFocus={setFocus} intl={intl}
          labels={{ mineLegend: s.mineLegend, freeLegend: s.freeLegend, everyoneLegend: s.everyoneLegend, pastLegend: s.pastLegend }}
        />
        {focus != null && (
          <div className="rounded-md border border-[color:var(--line-soft)] px-3 py-2 text-[0.88rem]" data-testid="ft-focus">
            <div className="font-semibold">{range(focus, focus)}</div>
            <div><span className="text-ink-soft">{s.focusFree}: </span>{focusNames.length ? focusNames.join(locale === 'ar' ? '، ' : ', ') : s.nobody}</div>
            {focusNot.length > 0 && <div><span className="text-ink-soft">{s.focusNot}: </span>{focusNot.join(locale === 'ar' ? '، ' : ', ')}</div>}
          </div>
        )}
      </Panel>

      <Panel data-testid="ft-suits">
        <h3 className="font-semibold">{s.suits}</h3>
        {answered < 2 ? <p className="text-[0.9rem] text-ink-soft">{s.waitTwo}</p>
          : all.length ? (
            <ul className="grid gap-1">
              {runs(all).map(([a, b]) => (
                <li key={a}><button type="button" className="text-start hover:underline" onClick={() => setFocus(a)} data-testid="ft-suit">{range(a, b)}</button></li>
              ))}
            </ul>
          ) : (
            <div className="grid gap-1 text-[0.9rem]">
              <p className="text-ink-soft">{s.suitsNone}</p>
              {best.slots.length > 0 && (
                <>
                  <p className="font-semibold">{s.bestSoFar(best.count, answered)}</p>
                  <ul className="grid gap-1">
                    {runs(best.slots).slice(0, 6).map(([a, b]) => (
                      <li key={a}><button type="button" className="text-start hover:underline" onClick={() => setFocus(a)}>{range(a, b)}</button></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        <Notify code={poll.code} s={s} locale={locale} />
      </Panel>

      <Panel>
        <h3 className="font-semibold">{s.people} <span className="text-ink-faint font-normal">({poll.people.filter((p) => p.answered).length}/{poll.people.length})</span></h3>
        <ul className="grid gap-1.5" data-testid="ft-people">
          {poll.people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3" data-testid={`ft-person-${p.name}`} data-answered={p.answered ? '1' : '0'}>
              <span className="flex items-center gap-2 min-w-0">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full ${p.answered ? 'bg-green-600 text-sand-100' : 'border border-[color:var(--line)]'}`} aria-hidden="true">
                  {p.answered && <CheckIcon className="size-3.5" />}
                </span>
                <span className="truncate font-medium">{p.name}</span>
                {(p.you || p.owner) && <span className="text-[0.78rem] text-ink-faint">({[p.you && s.you, p.owner && s.organiser].filter(Boolean).join(' · ')})</span>}
              </span>
              <span className="flex items-center gap-2 text-[0.8rem] text-ink-soft shrink-0">
                <span>{p.answered ? s.answered : p.claimed ? s.waiting : s.notJoined}</span>
                {p.tz && p.tz !== zone && <span className="text-ink-faint" dir="ltr">{p.tz}</span>}
                {poll.owner && !p.owner && (
                  <button type="button" aria-label={`${s.remove} ${p.name}`} className="grid size-7 place-items-center rounded hover:bg-[var(--line-soft)]"
                    onClick={async () => { try { apply(await removePerson(token!, code, p.id)) } catch (e) { fail(e) } }}>
                    <TrashIcon className="size-4" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {poll.owner && (
          <div className="flex flex-wrap gap-2">
            <Input value={more} placeholder={s.inviteePh} onChange={(e) => setMore(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMore() }} className="flex-1 min-w-[12rem]" aria-label={s.addPeople} data-testid="ft-more" />
            <Button onClick={addMore} disabled={!more.trim()} data-testid="ft-more-add"><UserPlusIcon />{s.addPeople}</Button>
          </div>
        )}
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[0.82rem] text-ink-faint">
        <span>{s.expires(new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long' }).format(poll.expiresAt))}</span>
        {poll.owner && <Button onClick={() => setConfirmDel(true)} data-testid="ft-delete"><TrashIcon />{s.deletePoll}</Button>}
      </div>

      {confirmDel && (
        <Sheet onClose={() => setConfirmDel(false)}>
          <SheetTitle>{s.deleteTitle}</SheetTitle>
          <p>{s.deleteBody}</p>
          <SheetActions>
            <Button onClick={() => setConfirmDel(false)}>{s.cancel}</Button>
            <Button variant="primary" data-testid="ft-delete-confirm" onClick={async () => {
              try { await deletePoll(token!, code); forgetPoll(code); setConfirmDel(false); onGone() } catch (e) { fail(e) }
            }}>{s.confirmDelete}</Button>
          </SheetActions>
        </Sheet>
      )}
    </>
  )
}

/** The web-push switch for one poll. Anybody with the link may turn it on. */
function Notify({ code, s, locale }: { code: string; s: S; locale: string }) {
  const [on, setOn] = useState(() => !!loadPushed()[code])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (!pushSupported()) return <p className="text-[0.82rem] text-ink-faint">{s.notifyNo}</p>
  async function enable() {
    setBusy(true); setNote('')
    try {
      const sub = await subscribeDevice()
      if (!sub) { setNote(Notification.permission === 'denied' ? s.notifyDenied : s.notifyNo); return }
      await subscribe(code, sub, locale)
      setPushed(code, sub.endpoint); setOn(true)
    } catch { setNote(s.err) } finally { setBusy(false) }
  }
  async function disable() {
    setBusy(true)
    try {
      const endpoint = loadPushed()[code] || (await currentSubscription())?.endpoint || ''
      await unsubscribe(code, endpoint)
      setPushed(code, null); setOn(false)
    } catch { setNote(s.err) } finally { setBusy(false) }
  }
  return (
    <div className="grid gap-1">
      {on ? (
        <div className="flex flex-wrap items-center gap-3" data-testid="ft-notify-on">
          <span className="inline-flex items-center gap-2 text-[0.9rem]"><BellIcon className="size-4" />{s.notifyOn}</span>
          <Button disabled={busy} onClick={disable} className="!py-1 !px-3">{s.notifyOff}</Button>
        </div>
      ) : (
        <StackActions><Button disabled={busy} onClick={enable} data-testid="ft-notify"><BellIcon />{s.notify}</Button></StackActions>
      )}
      {note && <p className="text-[0.82rem] text-ink-soft">{note}</p>}
    </div>
  )
}

/** What the server keeps for the signed-in person, and the button that deletes it. */
function YourData({ s, intl, session, onClose }: { s: S; intl: string; session: Session; onClose: () => void }) {
  const [data, setData] = useState<MyData | null>(null)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState(false)
  useEffect(() => { myData(session.token).then(setData, () => setErr(true)) }, [session.token])
  const fmt = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <Sheet onClose={onClose} data-testid="ft-data">
      <SheetTitle>{s.dataTitle}</SheetTitle>
      <p className="text-[0.9rem] text-ink-soft">{s.dataBody}</p>
      {done ? <p data-testid="ft-data-deleted">{s.deleteAllDone}</p> : err ? <p>{s.err}</p> : !data ? <Spinner /> : (
        <div className="grid gap-3 text-[0.9rem]">
          <div>
            <h4 className="font-semibold">{s.dataPolls} ({data.polls.length})</h4>
            <ul className="grid gap-1" data-testid="ft-data-polls">
              {data.polls.map((p) => (
                <li key={p.code}>{p.title || p.code} — {p.name}{p.owner ? ` (${s.dataOwner})` : ''} · {s.dataSlots(p.slots)} · {s.expires(fmt.format(p.expiresAt))}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">{s.dataKeys} ({data.passkeys.length})</h4>
            <ul className="grid gap-1">{data.passkeys.map((k) => <li key={k.id} dir="ltr" className="font-mono text-[0.82rem]">{k.id}… · {k.createdAt ? fmt.format(k.createdAt) : ''}</li>)}</ul>
          </div>
        </div>
      )}
      <SheetActions>
        <Button onClick={onClose}>{s.close}</Button>
        {!done && data && (
          <Button variant="primary" data-testid="ft-delete-all" onClick={async () => {
            try { await deleteAccount(session.token); setDone(true); saveSession(null) } catch { setErr(true) }
          }}>{s.deleteAll}</Button>
        )}
      </SheetActions>
    </Sheet>
  )
}
