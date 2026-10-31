// Where the Calls and Messages apps live. built-in-saudi hosts them at
// /apps/calls and /apps/messages on its own domain; Sawi Kalam (sawikalam.com)
// embeds the same components under its own domain and paths. Invite links, QR codes and in-app navigation all read this,
// so an embedding app sets it once before rendering and nothing else changes.
//
// `callMe` gates the personal "call me" link, which rings an owner by Web Push.
// Push needs a service worker with a push handler on the hosting origin, so an
// embedder without one turns it off rather than offering a link that never rings.
export interface CallsHost {
  site: string
  base: string
  /** Messages' own path, for its invite links. */
  messagesBase: string
  /** Where the office editors live, to share a live document into a call; null hides it. */
  docs: { word: string; excel: string; slides: string } | null
  callMe: boolean
}

let host: CallsHost = { site: 'https://built-in-saudi.com', base: '/apps/calls', messagesBase: '/apps/messages', docs: null, callMe: true }

export function configureCalls(h: Partial<CallsHost>) { host = { ...host, ...h } }
export const callsHost = (): CallsHost => host
