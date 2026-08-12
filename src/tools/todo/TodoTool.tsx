import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Link } from 'react-router-dom'
import { Stack, Button, Input, Spinner, Sheet, SheetTitle, SheetActions } from '../../components/ui'
import { InAppNote } from '../../components/ui/InAppNote'
import { TrashIcon, CloudIcon, UserPlusIcon, LockIcon, CheckIcon } from '../../components/icons'
import { loadGis, GOOGLE_CLIENT_ID, decodeJwt } from '../../lib/cvApi'
import { syncList, fetchLists, shareList, removeList } from './api'
import { loadLists, saveLists, mergeLists, newList, remaining, uid, type TodoList, type TodoItem } from './lib'

const STR = {
  en: {
    lists: 'Lists', newList: 'New list', listName: 'List name', rename: 'Rename',
    addItem: 'Add a task…', add: 'Add', empty: 'Nothing here yet — add your first task.',
    noLists: 'No lists yet.', left: (n: number) => `${n} left`, allDone: 'All done',
    clearDone: 'Clear finished', deleteList: 'Delete list',
    deleteTitle: 'Delete this list?', deleteBody: 'This removes the list and everything in it. If it is shared, it disappears for everyone.',
    deleteMine: 'Leave this shared list?', deleteMineBody: 'It stays with the owner — you just lose access on your devices.',
    cancel: 'Cancel', confirmDelete: 'Delete',
    sync: 'Sync & share', syncOn: 'Synced', syncing: 'Syncing…',
    syncBody: 'Sign in with Google to keep this list on your account, open it on any device, and share it with other people. Every other list stays on this device only.',
    signIn: 'Sign in with Google', signedInAs: (e: string) => `Signed in as ${e}`, signOut: 'Sign out',
    share: 'Share', shareTitle: 'Share this list', shareBody: 'Add the Google account emails of people who should see and edit this list. They will find it under their own lists once signed in.',
    emailPh: 'name@example.com', shareAdd: 'Add', sharedWith: 'Shared with', noMembers: 'Not shared with anyone yet.', remove: 'Remove',
    save: 'Save', saved: 'Saved', ownerOnly: 'Only the owner can change sharing.',
    sharedBadge: 'Shared with you', err: 'Something went wrong. Try again.',
    signinErr: 'Google sign-in couldn’t load. Disable blockers and retry.',
    privacyWord: 'Privacy page', privacy: 'Lists live in this browser. Only a list you switch sync on for is stored on your account — delete it anytime on the',
  },
  ar: {
    lists: 'القوائم', newList: 'قائمة جديدة', listName: 'اسم القائمة', rename: 'إعادة تسمية',
    addItem: 'أضِف مهمة…', add: 'أضِف', empty: 'لا شيء هنا بعد — أضِف مهمتك الأولى.',
    noLists: 'لا قوائم بعد.', left: (n: number) => `${n} متبقٍّ`, allDone: 'اكتمل كل شيء',
    clearDone: 'امسح المنجز', deleteList: 'احذف القائمة',
    deleteTitle: 'حذف هذه القائمة؟', deleteBody: 'يزيل هذا القائمة وكل ما فيها. وإن كانت مشتركة فستختفي عن الجميع.',
    deleteMine: 'مغادرة القائمة المشتركة؟', deleteMineBody: 'تبقى لدى مالكها — أنت فقط تفقد الوصول من أجهزتك.',
    cancel: 'إلغاء', confirmDelete: 'حذف',
    sync: 'مزامنة ومشاركة', syncOn: 'مُزامَنة', syncing: 'جارٍ المزامنة…',
    syncBody: 'سجّل الدخول بحساب جوجل لإبقاء هذه القائمة في حسابك وفتحها من أي جهاز ومشاركتها مع آخرين. تبقى بقية القوائم على هذا الجهاز وحده.',
    signIn: 'سجّل الدخول بجوجل', signedInAs: (e: string) => `مسجَّل الدخول باسم ${e}`, signOut: 'تسجيل الخروج',
    share: 'مشاركة', shareTitle: 'شارك هذه القائمة', shareBody: 'أضِف بُرُد حسابات جوجل لمن تريد أن يرى القائمة ويعدّلها. ستظهر لهم ضمن قوائمهم بعد تسجيل الدخول.',
    emailPh: 'name@example.com', shareAdd: 'أضِف', sharedWith: 'مشتركة مع', noMembers: 'ليست مشتركة مع أحد بعد.', remove: 'إزالة',
    save: 'حفظ', saved: 'حُفظت', ownerOnly: 'المالك وحده يستطيع تغيير المشاركة.',
    sharedBadge: 'مشتركة معك', err: 'حدث خطأ ما. حاول مجددًا.',
    signinErr: 'تعذّر تحميل تسجيل دخول جوجل. عطّل المانعات وأعد المحاولة.',
    privacyWord: 'صفحة الخصوصية', privacy: 'تعيش القوائم في هذا المتصفح. وتُحفظ في حسابك فقط القائمة التي تُفعّل لها المزامنة — احذفها متى شئت من',
  },
}

export default function TodoTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [lists, setLists] = useState<TodoList[]>(() => loadLists())
  const [activeId, setActiveId] = useState<string>(() => loadLists()[0]?.id || '')
  const [draft, setDraft] = useState('')
  const [idToken, setIdToken] = useState<string | null>(null)
  const [me, setMe] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [syncOpen, setSyncOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [memberDraft, setMemberDraft] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const gisRef = useRef<Awaited<ReturnType<typeof loadGis>> | null>(null)
  // Set while we're applying a server response, so the persist effect doesn't
  // immediately push the same data back up in a loop.
  const applying = useRef(false)

  const active = lists.find((l) => l.id === activeId) || null

  useEffect(() => { saveLists(lists) }, [lists])

  // Start people off with one list rather than an empty screen.
  useEffect(() => {
    if (lists.length === 0) {
      const l = newList(locale === 'ar' ? 'مهامي' : 'My tasks')
      setLists([l]); setActiveId(l.id)
    } else if (!activeId) setActiveId(lists[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Google Identity Services — loaded once, but never forced: the tool is fully
  // usable signed out, and sign-in is only offered when a list opts into sync.
  useEffect(() => {
    let cancelled = false
    loadGis().then((id) => {
      if (cancelled) return
      id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r) => { setIdToken(r.credential); setMe(decodeJwt(r.credential).email || '') },
      })
      gisRef.current = id
    }).catch(() => { /* only matters if they try to sync */ })
    return () => { cancelled = true }
  }, [])

  const pull = useCallback(async (token: string) => {
    try {
      const { lists: remote } = await fetchLists(token)
      applying.current = true
      setLists((cur) => mergeLists(cur, remote))
      setTimeout(() => { applying.current = false }, 0)
    } catch { /* offline — the local copy is still authoritative */ }
  }, [])

  // On sign-in, pull everything this account owns or is shared into.
  useEffect(() => { if (idToken) pull(idToken) }, [idToken, pull])

  // A shared list changes under you, so re-pull while the tab is open and on return.
  useEffect(() => {
    if (!idToken || !lists.some((l) => l.cloud)) return
    const iv = window.setInterval(() => pull(idToken), 20000)
    const onReturn = () => { if (!document.hidden) pull(idToken) }
    document.addEventListener('visibilitychange', onReturn)
    return () => { window.clearInterval(iv); document.removeEventListener('visibilitychange', onReturn) }
  }, [idToken, lists, pull])

  /** Apply a change locally, then push it up if this list is synced. */
  function edit(id: string, fn: (l: TodoList) => TodoList) {
    setLists((cur) => cur.map((l) => (l.id === id ? { ...fn(l), updatedAt: Date.now() } : l)))
  }
  // Push a synced list up shortly after it changes (debounced — typing a task
  // shouldn't be one request per keystroke).
  const pushT = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!idToken || applying.current) return
    const l = lists.find((x) => x.id === activeId)
    if (!l?.cloud) return
    window.clearTimeout(pushT.current)
    pushT.current = window.setTimeout(() => { syncList(idToken, l).catch(() => {}) }, 700)
    return () => window.clearTimeout(pushT.current)
  }, [lists, activeId, idToken])

  function addItem() {
    const text = draft.trim()
    if (!text || !active) return
    const item: TodoItem = { id: uid(), text, done: false, at: Date.now(), by: me || undefined }
    edit(active.id, (l) => ({ ...l, items: [...l.items, item] }))
    setDraft('')
  }
  const toggle = (itemId: string) => active && edit(active.id, (l) => ({ ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }))
  const removeItem = (itemId: string) => active && edit(active.id, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) }))
  const clearDone = () => active && edit(active.id, (l) => ({ ...l, items: l.items.filter((i) => !i.done) }))

  function addList() {
    const l = newList(locale === 'ar' ? 'قائمة جديدة' : 'New list')
    setLists((c) => [l, ...c]); setActiveId(l.id)
  }

  function signIn() { try { gisRef.current?.prompt() } catch { setErr(s.signinErr) } }

  /** Turn sync on for the active list: sign in if needed, then push it up. */
  async function enableSync() {
    if (!active) return
    if (!idToken) { signIn(); return }
    setBusy(true); setErr('')
    try {
      const { list } = await syncList(idToken, active)
      applying.current = true
      setLists((cur) => cur.map((l) => (l.id === list.id ? { ...list, cloud: true } : l)))
      setTimeout(() => { applying.current = false }, 0)
      setSyncOpen(false)
    } catch (e) { setErr((e as Error).message || s.err) } finally { setBusy(false) }
  }

  // Sign-in completed while the sync sheet was open → finish the job.
  useEffect(() => {
    if (idToken && syncOpen && active && !active.cloud) enableSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken])

  async function saveMembers(next: string[]) {
    if (!active || !idToken) return
    setBusy(true); setErr('')
    try {
      const { list } = await shareList(idToken, active.id, next)
      applying.current = true
      setLists((cur) => cur.map((l) => (l.id === list.id ? { ...list, cloud: true } : l)))
      setTimeout(() => { applying.current = false }, 0)
    } catch (e) { setErr((e as Error).message || s.err) } finally { setBusy(false) }
  }
  function addMember() {
    const m = memberDraft.trim().toLowerCase()
    if (!m || !m.includes('@') || !active) return
    saveMembers([...(active.members || []), m]); setMemberDraft('')
  }

  async function doDelete() {
    if (!active) return
    setConfirmDel(false)
    const id = active.id
    if (active.cloud && idToken) await removeList(idToken, id).catch(() => {})
    setLists((cur) => { const next = cur.filter((l) => l.id !== id); setActiveId(next[0]?.id || ''); return next })
  }

  const left = active ? remaining(active) : 0

  return (
    <Stack data-testid="todo">
      {/* List switcher — chips, so a shared list is one tap away. */}
      <div className="flex items-center gap-2 flex-wrap">
        {lists.map((l) => (
          <button key={l.id} type="button" onClick={() => setActiveId(l.id)} data-testid="todo-list-chip"
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[0.88rem] font-medium cursor-pointer transition-colors ${
              l.id === activeId ? 'bg-green-600 text-sand-100 border-green-600' : 'bg-[var(--surface)] text-ink-soft border-[color:var(--line)] hover:text-green-700'
            }`}>
            {l.cloud && <CloudIcon className="w-3.5 h-3.5" />}
            <span className="truncate max-w-[10rem]">{l.title}</span>
            <span className="text-[0.75rem] opacity-70">{remaining(l) || ''}</span>
          </button>
        ))}
        <Button onClick={addList} data-testid="todo-new-list" className="!h-9">{s.newList}</Button>
      </div>

      {active && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <Input value={active.title} onChange={(e) => edit(active.id, (l) => ({ ...l, title: e.target.value }))}
              aria-label={s.listName} data-testid="todo-title" className="!h-10 max-w-[18rem] font-semibold" />
            {active.shared && <span className="text-[0.72rem] uppercase tracking-[0.08em] text-ink-faint">{s.sharedBadge}</span>}
            <span className="flex-1" />
            {active.cloud ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-[0.8rem] text-green-700 font-medium" data-testid="todo-synced"><CloudIcon className="w-4 h-4" /> {s.syncOn}</span>
                {!active.shared && <Button onClick={() => setShareOpen(true)} data-testid="todo-share" className="!h-9"><UserPlusIcon /> {s.share}</Button>}
              </>
            ) : (
              <Button onClick={() => setSyncOpen(true)} data-testid="todo-enable-sync" className="!h-9"><CloudIcon /> {s.sync}</Button>
            )}
          </div>

          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); addItem() }}>
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={s.addItem} aria-label={s.addItem} data-testid="todo-input" className="flex-1" />
            <Button variant="primary" type="submit" data-testid="todo-add" disabled={!draft.trim()}>{s.add}</Button>
          </form>

          {active.items.length === 0 ? (
            <p className="text-[0.9rem] text-ink-faint" data-testid="todo-empty">{s.empty}</p>
          ) : (
            <ul className="flex flex-col list-none p-0 m-0 border border-[color:var(--line)] rounded-md overflow-hidden" data-testid="todo-items">
              {active.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-[color:var(--line-soft)] last:border-b-0 bg-[var(--surface)]" data-testid="todo-item">
                  <button type="button" onClick={() => toggle(i.id)} aria-pressed={i.done} data-testid="todo-toggle"
                    className={`shrink-0 w-5 h-5 rounded-[5px] grid place-items-center border cursor-pointer transition-colors ${
                      i.done ? 'bg-green-600 border-green-600 text-sand-100' : 'bg-transparent border-[color:var(--line)] text-transparent hover:border-green-500'
                    }`}>
                    <CheckIcon className="w-3.5 h-3.5" />
                  </button>
                  <span className={`flex-1 text-[0.95rem] leading-snug ${i.done ? 'text-ink-faint line-through' : 'text-ink'}`}>{i.text}</span>
                  {active.shared && i.by && <span className="text-[0.72rem] text-ink-faint shrink-0 hidden sm:inline">{i.by}</span>}
                  <button type="button" onClick={() => removeItem(i.id)} aria-label={s.remove} title={s.remove} data-testid="todo-remove"
                    className="shrink-0 grid place-items-center w-7 h-7 rounded-md bg-transparent border-0 text-ink-faint hover:text-[var(--danger)] cursor-pointer [&_svg]:w-4 [&_svg]:h-4"><TrashIcon /></button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-3 flex-wrap text-[0.85rem] text-ink-faint">
            <span data-testid="todo-left">{left === 0 && active.items.length > 0 ? s.allDone : s.left(left)}</span>
            {active.items.some((i) => i.done) && (
              <button type="button" onClick={clearDone} data-testid="todo-clear-done" className="bg-transparent border-0 underline cursor-pointer text-ink-faint hover:text-green-700">{s.clearDone}</button>
            )}
            <span className="flex-1" />
            <button type="button" onClick={() => setConfirmDel(true)} data-testid="todo-delete-list"
              className="inline-flex items-center gap-1.5 bg-transparent border-0 cursor-pointer text-ink-faint hover:text-[var(--danger)] [&_svg]:w-3.5 [&_svg]:h-3.5"><TrashIcon /> {s.deleteList}</button>
          </div>
        </>
      )}

      {!active && <p className="text-[0.9rem] text-ink-faint">{s.noLists}</p>}

      <p className="text-[0.8rem] text-ink-faint flex items-start gap-1.5">
        <LockIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>{s.privacy}{' '}<Link to={localePath(locale, '/privacy')} className="underline hover:text-green-600">{s.privacyWord}</Link>.</span>
      </p>

      {syncOpen && (
        <Sheet onClose={() => !busy && setSyncOpen(false)} data-testid="todo-sync-sheet">
          <SheetTitle>{s.sync}</SheetTitle>
          <p className="text-[0.9rem] text-ink-soft leading-relaxed">{s.syncBody}</p>
          {!idToken && <InAppNote locale={locale} />}
          {err && <p className="text-[0.85rem] text-gold-500" data-testid="todo-sync-err">{err}</p>}
          <SheetActions>
            <Button variant="primary" onClick={enableSync} disabled={busy} data-testid="todo-sync-go">
              {busy ? <><Spinner className="size-4" /> {s.syncing}</> : idToken ? s.sync : s.signIn}
            </Button>
          </SheetActions>
        </Sheet>
      )}

      {shareOpen && active && (
        <Sheet onClose={() => !busy && setShareOpen(false)} data-testid="todo-share-sheet">
          <SheetTitle>{s.shareTitle}</SheetTitle>
          <p className="text-[0.9rem] text-ink-soft leading-relaxed">{s.shareBody}</p>
          <div className="flex items-center gap-2">
            <Input value={memberDraft} onChange={(e) => setMemberDraft(e.target.value)} type="email" placeholder={s.emailPh}
              aria-label={s.emailPh} data-testid="todo-member-input" className="flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMember() } }} />
            <Button variant="primary" onClick={addMember} disabled={busy || !memberDraft.includes('@')} data-testid="todo-member-add">{s.shareAdd}</Button>
          </div>
          <p className="text-[0.8rem] font-semibold text-ink-soft">{s.sharedWith}</p>
          {(active.members || []).length === 0 ? (
            <p className="text-[0.85rem] text-ink-faint" data-testid="todo-no-members">{s.noMembers}</p>
          ) : (
            <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
              {(active.members || []).map((m) => (
                <li key={m} className="flex items-center gap-2 text-[0.88rem]" data-testid="todo-member">
                  <span className="flex-1 truncate">{m}</span>
                  <button type="button" onClick={() => saveMembers((active.members || []).filter((x) => x !== m))} disabled={busy} data-testid="todo-member-remove"
                    className="bg-transparent border-0 text-[0.8rem] text-ink-faint hover:text-[var(--danger)] cursor-pointer underline">{s.remove}</button>
                </li>
              ))}
            </ul>
          )}
          {err && <p className="text-[0.85rem] text-gold-500" data-testid="todo-share-err">{err}</p>}
        </Sheet>
      )}

      {confirmDel && active && (
        <Sheet onClose={() => setConfirmDel(false)} data-testid="todo-delete-sheet">
          <SheetTitle>{active.shared ? s.deleteMine : s.deleteTitle}</SheetTitle>
          <p className="text-[0.9rem] text-ink-soft leading-relaxed">{active.shared ? s.deleteMineBody : s.deleteBody}</p>
          <SheetActions>
            <Button onClick={() => setConfirmDel(false)}>{s.cancel}</Button>
            <Button variant="primary" onClick={doDelete} data-testid="todo-delete-confirm">{s.confirmDelete}</Button>
          </SheetActions>
        </Sheet>
      )}
    </Stack>
  )
}
