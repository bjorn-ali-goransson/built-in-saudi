// Saved contacts on the Calls start screen (#221): people you've been in a call
// with who publish a "call me" link, so ringing them again is one tap. Kept on this
// device only — see src/lib/contacts.ts.
import { useState } from 'react'
import { PhoneIcon, TrashIcon, ChatIcon } from '../../components/icons'
import type { Contact } from '../../lib/contacts'
import type { Str } from './strings'
import { useDms } from '../../lib/dms'
import { DmThread } from './DmThread'

export function Contacts({ s, contacts, onRemove, myName }: { s: Str; contacts: Contact[]; onRemove: (code: string) => void; myName: string }) {
  const { dms, clear } = useDms()
  const [openCode, setOpenCode] = useState('')
  if (!contacts.length) return null
  const open = contacts.find((c) => c.code === openCode) || null
  const countOf = (code: string) => dms.filter((m) => m.from === code && !m.mine).length
  // Their own link, so the call page greets us with who we're ringing.
  const call = (c: Contact) => window.location.assign(`/call/?c=${c.code}${c.name ? `&n=${encodeURIComponent(c.name)}` : ''}`)
  return (
    <div className="w-full rounded-md border border-sand-100/25 bg-white/10 p-3 flex flex-col gap-2" data-testid="call-contacts">
      <p className="text-[0.82rem] font-semibold text-sand-100 flex items-center gap-1.5">
        <PhoneIcon className="w-4 h-4" /> {s.contacts} · {contacts.length}
      </p>
      <ul className="flex flex-col gap-1 list-none p-0 m-0">
        {contacts.map((c) => (
          <li key={c.code} className="flex items-center gap-2 py-1 border-t border-sand-100/10 first:border-t-0" data-testid="call-contact-row">
            <span className="min-w-0 flex-1 truncate text-[0.85rem] text-sand-100"><bdi>{c.name || c.code}</bdi></span>
            <button type="button" onClick={() => setOpenCode(c.code)} data-testid="call-contact-dm"
              title={s.dmOpen} aria-label={s.dmOpen}
              className="relative inline-flex items-center justify-center h-8 w-8 rounded-md bg-transparent border border-sand-100/25 text-sand-100/75 hover:text-sand-100 hover:bg-white/10 cursor-pointer [&_svg]:w-4 [&_svg]:h-4">
              <ChatIcon />
              {countOf(c.code) > 0 && (
                <span data-testid="call-contact-dm-badge"
                  className="absolute -top-1 -end-1 min-w-[15px] h-[15px] px-1 grid place-items-center rounded-full bg-[var(--gold-500)] text-white font-body text-[0.58rem] font-bold leading-none">
                  {countOf(c.code) > 9 ? '9+' : countOf(c.code)}
                </span>
              )}
            </button>
            <button type="button" onClick={() => call(c)} data-testid="call-contact-call"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-sand-100 text-green-900 text-[0.78rem] font-semibold border-0 cursor-pointer hover:bg-white [&_svg]:w-3.5 [&_svg]:h-3.5">
              <PhoneIcon /> {s.call}
            </button>
            <button type="button" onClick={() => onRemove(c.code)} title={s.remove} aria-label={s.remove} data-testid="call-contact-remove"
              className="grid place-items-center h-8 w-7 rounded-md bg-transparent border-0 text-sand-100/50 hover:text-[var(--gold-400)] cursor-pointer [&_svg]:w-3.5 [&_svg]:h-3.5"><TrashIcon /></button>
          </li>
        ))}
      </ul>
      {open && (
        <DmThread s={s} contact={open} myName={myName} onClose={() => setOpenCode('')} onClear={clear}
          messages={dms.filter((m) => m.from === open.code)} />
      )}
    </div>
  )
}
