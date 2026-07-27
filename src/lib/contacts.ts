// Saved call contacts (#221) — people you've been in a call with who publish a
// personal "call me" link, kept on THIS device only. Nothing is uploaded: the link
// code reaches us peer-to-peer over the call's data channel, and saving it just
// means we remember a code we were already told.
import { useCallback, useEffect, useState } from 'react'

export interface Contact { code: string; name: string; at: number }

const KEY = 'bis-call-contacts'
const MAX = 50

export function listContacts(): Contact[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(v)) return []
    return v
      .filter((c) => c && typeof c.code === 'string' && c.code)
      .map((c) => ({ code: c.code, name: String(c.name || ''), at: Number(c.at) || 0 }))
      .sort((a, b) => b.at - a.at)
  } catch { return [] }
}

function write(list: Contact[]): Contact[] {
  const next = list.slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage full */ }
  try { window.dispatchEvent(new Event('bis-contacts')) } catch { /* */ }
  return next
}

/** Add or refresh one contact (keyed by their link code). */
export function addContact(code: string, name: string): Contact[] {
  if (!code) return listContacts()
  const rest = listContacts().filter((c) => c.code !== code)
  return write([{ code, name, at: Date.now() }, ...rest])
}
export function removeContact(code: string): Contact[] {
  return write(listContacts().filter((c) => c.code !== code))
}
export const hasContact = (code: string) => !!code && listContacts().some((c) => c.code === code)

/** Live view of the saved contacts, kept in step across components. */
export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>(() => listContacts())
  useEffect(() => {
    const refresh = () => setContacts(listContacts())
    window.addEventListener('bis-contacts', refresh)
    window.addEventListener('storage', refresh) // another tab
    return () => { window.removeEventListener('bis-contacts', refresh); window.removeEventListener('storage', refresh) }
  }, [])
  const add = useCallback((code: string, name: string) => setContacts(addContact(code, name)), [])
  const remove = useCallback((code: string) => setContacts(removeContact(code)), [])
  return { contacts, add, remove }
}
