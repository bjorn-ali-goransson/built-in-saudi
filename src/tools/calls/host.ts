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
  /** Where a NEW meeting is made, when that is not this app's own lobby. Sawi
   *  Kalam makes meetings on its front page, owned by a signed-in organiser, so
   *  "start your own call" and "new call" go there rather than opening a room
   *  nobody owns. null keeps them in the lobby, as built-in-saudi does. */
  newMeetingPath: string | null
  /** A room the embedder KNOWS is a real meeting, though nobody may be in it yet
   *  (Sawi Kalam's server records meetings). An empty room is then "not started",
   *  not "ended", and a guest can knock and wait for the organiser. */
  pendingRoom: string | null
  /** Ask for a name BEFORE the call (built-in-saudi's start screen). false
   *  starts or knocks with no name field, and asks once the person is waiting or
   *  in the call instead; the answer is remembered for next time. */
  askNameFirst: boolean
  /** The screen before a meeting's call says what the meeting is — its title,
   *  time and length from the link — and nothing else: no blurb about how calls
   *  work, no privacy line and no invite button (the invitation is made before
   *  the call). false keeps built-in-saudi's start screen. */
  meetingSplash: boolean
  /** Offer, in the call, to notify when somebody joins while the tab is in
   *  the background. false never shows the offer. */
  notifyPrompt: boolean
  /** The hosting app's name and colours, for what leaves the app: the invite
   *  picture, its caption, and the QR codes. bg/ink/soft/accent paint the picture
   *  (soft is the small print, accent the link); qr is the ink of every QR. */
  brand: {
    name: { en: string; ar: string }
    bg: string; ink: string; soft: string; accent: string; qr: string
    /** The typeface a meeting's invitation is set in, as a CSS family list;
     *  the page must load it. Unset draws in the system's own sans-serif. */
    font?: string
  }
}

let host: CallsHost = { site: 'https://built-in-saudi.com', base: '/apps/calls', messagesBase: '/apps/messages', docs: null, callMe: true, newMeetingPath: null, pendingRoom: null, askNameFirst: true, meetingSplash: false, notifyPrompt: true,
  brand: { name: { en: 'Built in Saudi', ar: 'بُنِيَ في السعودية' }, bg: '#0e5a3f', ink: '#faf7f0', soft: 'rgba(250,247,240,0.82)', accent: '#d6a33f', qr: '#0e5a3f' } }

export function configureCalls(h: Partial<CallsHost>) { host = { ...host, ...h } }
export const callsHost = (): CallsHost => host
