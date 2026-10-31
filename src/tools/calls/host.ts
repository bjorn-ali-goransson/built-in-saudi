// Where the Calls app lives. built-in-saudi hosts it at /apps/calls on its own
// domain; Sawi Kalam (sawikalam.com) embeds the same component under its own
// domain and path. Invite links, QR codes and in-app navigation all read this,
// so an embedding app sets it once before rendering and nothing else changes.
//
// `callMe` gates the personal "call me" link, which rings an owner by Web Push.
// Push needs a service worker with a push handler on the hosting origin, so an
// embedder without one turns it off rather than offering a link that never rings.
export interface CallsHost {
  site: string
  base: string
  callMe: boolean
}

let host: CallsHost = { site: 'https://built-in-saudi.com', base: '/apps/calls', callMe: true }

export function configureCalls(h: Partial<CallsHost>) { host = { ...host, ...h } }
export const callsHost = (): CallsHost => host
