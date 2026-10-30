// The full-screen frame around every office editor: title, save state, the File
// menu, the collaboration button, and the banners a live session needs.
//
// PORTALLED to <body>, because ToolPage's wrapper animates with a `both` fill and
// so keeps a transform for ever — and a transformed ancestor becomes the
// containing block for `position: fixed`, so `inset-0` would resolve against the
// content column instead of the screen (the video editor learned this first).
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BackIcon, UsersIcon, UndoIcon, CheckIcon } from '../icons'
import { RPopover, RItem } from './Ribbon'
import { OFFICE_STR, type OfficeStr } from './strings'
import type { SaveStatus, Collab, EditorKit } from './hooks'
import { CollabPanel } from './CollabPanel'
import { Sheet, SheetTitle, SheetActions, Button } from '../ui'
import { canLinkFiles } from '../../lib/docStore'
import { sendToMessages } from '../../lib/shareIntent'

export function EditorShell<D>(props: {
  locale: 'en' | 'ar'
  kit: EditorKit<D>
  title: string
  onTitle: (t: string) => void
  status: SaveStatus
  fileName?: string
  needsPermission?: boolean
  onBack: () => void
  onSave: () => void
  onLink: () => void
  onUnlink: () => void
  onExport: (ext: string) => void
  onPrint?: () => void
  /** The document as a file, for 'Send a copy in Messages'. */
  exportBlob?: (ext: string) => Promise<{ blob: Blob; name: string }>
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  collab: Collab
  onSaveCopy?: () => void
  /** Extra items at the top of the File menu (an editor's own: "Import into this sheet"…). */
  fileExtra?: (close: () => void) => ReactNode
  children: ReactNode
  busy?: string
}) {
  const s = OFFICE_STR[props.locale]
  const { collab } = props
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); props.onSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const guestState = collab.isGuest ? collab.state : null
  const others = collab.roster.filter((m) => m.client !== collab.me)
  const live = collab.state === 'live'

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-[var(--bg)] text-ink" dir={props.locale === 'ar' ? 'rtl' : 'ltr'} lang={props.locale} data-testid="office-shell" data-kind={props.kit.kind}>
      <header className="flex-none flex items-center gap-2 px-2 py-1.5 bg-[var(--surface)] border-b border-[color:var(--line-soft)]">
        <button type="button" onClick={props.onBack} aria-label={s.back} title={s.back} data-testid="office-back" className="grid place-items-center size-9 rounded-md border-0 bg-transparent cursor-pointer hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] [&_svg]:size-5 rtl:[&_svg]:-scale-x-100"><BackIcon /></button>
        <RPopover label={s.file} testid="office-file" trigger={<span className="text-[0.88rem] font-semibold px-1">{s.file}</span>}>
          {(close) => (
            <div className="py-1 w-[260px]">
              {props.fileExtra?.(close)}
              <RItem testid="office-save" hint="Ctrl+S" onClick={() => { close(); props.onSave() }}>{s.save}</RItem>
              {canLinkFiles() && <RItem testid="office-link" onClick={() => { close(); props.onLink() }}>{props.fileName ? s.saveAs : s.linkFile}</RItem>}
              {props.fileName && <RItem testid="office-unlink" onClick={() => { close(); props.onUnlink() }}>{s.unlink}</RItem>}
              <div className="px-3 pt-2 pb-1 text-[0.72rem] text-ink-faint uppercase tracking-wide rtl:tracking-normal">{s.exportAs}</div>
              {props.kit.formats.map((f) => (
                <RItem key={f.ext} testid={`office-export-${f.ext.slice(1)}`} onClick={() => { close(); props.onExport(f.ext) }}>{f.label} <span className="text-ink-faint">{f.ext}</span></RItem>
              ))}
              {props.exportBlob && !collab.isGuest && (
                <RItem testid="office-send-messages" onClick={() => {
                  close()
                  const ext = props.kit.formats[0].ext
                  if (!sendToMessages(props.locale, async () => { const r = await props.exportBlob!(ext); return { kind: 'file', name: r.name, blob: r.blob } })) alert(s.popupBlocked)
                }}>{s.sendCopyMessages}</RItem>
              )}
              {props.onPrint && <RItem testid="office-print" hint="Ctrl+P" onClick={() => { close(); props.onPrint!() }}>{s.print}</RItem>}
              {collab.isGuest && props.onSaveCopy && <RItem testid="office-save-copy" onClick={() => { close(); props.onSaveCopy!() }}>{s.saveCopy}</RItem>}
            </div>
          )}
        </RPopover>
        <input
          dir="auto"
          aria-label="Title"
          data-testid="office-title"
          value={props.title}
          placeholder={s.untitled}
          onChange={(e) => props.onTitle(e.target.value)}
          className="min-w-0 flex-1 max-w-[420px] h-8 px-2 rounded-sm border border-transparent hover:border-[color:var(--line)] focus:border-green-600 bg-transparent text-[0.98rem] font-semibold text-ink outline-none"
        />
        <SaveChip s={s} status={props.status} fileName={props.fileName} guest={collab.isGuest} />
        <div className="flex-1" />
        {props.onUndo && (
          <div className="flex items-center max-[480px]:hidden">
            <button type="button" aria-label={s.undo} title={`${s.undo} (Ctrl+Z)`} data-testid="office-undo" disabled={!props.canUndo} onMouseDown={(e) => e.preventDefault()} onClick={props.onUndo} className="grid place-items-center size-8 rounded-sm border-0 bg-transparent cursor-pointer disabled:opacity-30 hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] [&_svg]:size-[18px] rtl:[&_svg]:-scale-x-100"><UndoIcon /></button>
            <button type="button" aria-label={s.redo} title={`${s.redo} (Ctrl+Y)`} data-testid="office-redo" disabled={!props.canRedo} onMouseDown={(e) => e.preventDefault()} onClick={props.onRedo} className="grid place-items-center size-8 rounded-sm border-0 bg-transparent cursor-pointer disabled:opacity-30 hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] [&_svg]:size-[18px] -scale-x-100 rtl:scale-x-100"><UndoIcon /></button>
          </div>
        )}
        {others.length > 0 && (
          <div className="flex -space-x-2 rtl:space-x-reverse max-[560px]:hidden" data-testid="office-avatars">
            {others.slice(0, 4).map((m) => (
              <span key={m.client} title={m.name} className="grid place-items-center size-7 rounded-full text-[0.7rem] font-bold text-white ring-2 ring-[var(--surface)]" style={{ background: m.color, opacity: m.online ? 1 : 0.4 }}>{initials(m.name)}</span>
            ))}
          </div>
        )}
        <button
          type="button"
          data-testid="office-share"
          data-live={live ? '1' : '0'}
          onClick={() => { setShareOpen(true); collab.clearUnread() }}
          className={`relative inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-[0.85rem] font-semibold cursor-pointer [&_svg]:size-4 ${live ? 'border-green-700 bg-green-600 text-[color:var(--primary-ink)]' : 'border-[color:var(--line)] bg-[var(--surface)] text-ink'}`}
        >
          <UsersIcon /><span className="max-[480px]:hidden">{live ? s.live : s.share}</span>
          {collab.unread > 0 && <span data-testid="office-unread" className="absolute -top-1 -end-1 min-w-4 h-4 px-1 rounded-full bg-[color:var(--danger)] text-white text-[0.65rem] leading-4">{collab.unread}</span>}
        </button>
      </header>
      {guestState && guestState !== 'live' && (
        <Banner testid="office-banner" state={guestState}>
          {guestState === 'connecting' ? s.joining : guestState === 'owner-left' ? s.ownerLeft : guestState === 'kicked' ? s.kicked : s.ended}
          {guestState !== 'connecting' && props.onSaveCopy && <button type="button" data-testid="office-banner-save" onClick={props.onSaveCopy} className="ms-2 underline border-0 bg-transparent cursor-pointer text-inherit font-semibold">{s.saveCopy}</button>}
        </Banner>
      )}
      {collab.isGuest && guestState === 'live' && collab.role === 'view' && <Banner testid="office-viewonly" state="view">{s.viewOnly}</Banner>}
      {collab.refusedBy && <Banner testid="office-refused" state="view">{s.refused(collab.refusedBy)}</Banner>}
      {props.needsPermission && (
        <Banner testid="office-permission" state="view">
          <span dir="auto">{s.linkedFileGone(props.fileName || '')}</span>
          <button type="button" data-testid="office-permission-allow" onClick={props.onSave} className="ms-2 underline border-0 bg-transparent cursor-pointer text-inherit font-semibold">{s.linkedFileAllow}</button>
          <button type="button" data-testid="office-permission-stop" onClick={props.onUnlink} className="ms-2 underline border-0 bg-transparent cursor-pointer text-inherit">{s.linkedFileStop}</button>
        </Banner>
      )}
      <div className="flex-1 min-h-0 flex flex-col relative">{props.children}</div>
      {props.busy && (
        <div className="absolute inset-0 z-[5] grid place-items-center bg-[color-mix(in_srgb,var(--bg)_70%,transparent)]" data-testid="office-busy">
          <div className="px-4 py-3 rounded-md bg-[var(--surface)] shadow-[var(--shadow-md)] text-[0.95rem]">{props.busy}</div>
        </div>
      )}
      {shareOpen && <CollabPanel locale={props.locale} collab={collab} tool={props.kit.tool} title={props.title} onClose={() => setShareOpen(false)} />}
    </div>,
    document.body,
  )
}

function SaveChip({ s, status, fileName, guest }: { s: OfficeStr; status: SaveStatus; fileName?: string; guest: boolean }) {
  if (guest) return null
  const text = status === 'saving' ? s.saving : status === 'unsaved' ? s.unsaved : status === 'error' ? s.saveError : fileName ? s.savedFile(fileName) : s.saved
  return (
    <span data-testid="office-status" data-status={status} title={text} className={`flex-none inline-flex items-center gap-1 text-[0.76rem] max-w-[220px] truncate max-[720px]:hidden ${status === 'error' ? 'text-[color:var(--danger)]' : 'text-ink-faint'}`}>
      {status === 'saved' && <span className="[&_svg]:size-3.5"><CheckIcon /></span>}{text}
    </span>
  )
}

function Banner({ children, testid, state }: { children: ReactNode; testid: string; state: string }) {
  const warn = state !== 'connecting' && state !== 'view'
  return (
    <div data-testid={testid} data-state={state} role="status" className={`flex-none px-3 py-2 text-[0.86rem] border-b border-[color:var(--line-soft)] ${warn ? 'bg-[color-mix(in_srgb,var(--color-gold-400)_22%,var(--surface))]' : 'bg-[color-mix(in_srgb,var(--color-green-600)_8%,var(--surface))]'}`}>
      {children}
    </div>
  )
}

export function initials(n: string): string {
  const parts = n.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase()
}

/** "Some things did not come across" — the loss ledger an import or export produced. */
export function LossDialog({ locale, loss, dir, onClose }: { locale: 'en' | 'ar'; loss: string[]; dir: 'import' | 'export'; onClose: () => void }) {
  const s = OFFICE_STR[locale]
  return (
    <Sheet onClose={onClose} data-testid="office-loss">
      <SheetTitle>{dir === 'import' ? s.lossTitle : s.lossExportTitle}</SheetTitle>
      <ul className="list-disc ps-5 space-y-1 text-[0.9rem]" data-testid="office-loss-list">
        {loss.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      <SheetActions><Button variant="primary" onClick={onClose} data-testid="office-loss-ok">{s.lossOk}</Button></SheetActions>
    </Sheet>
  )
}
