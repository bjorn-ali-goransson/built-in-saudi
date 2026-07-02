// Web Push opt-in for prayer notifications. Talks to the Cloud Functions backend.
const VAPID_PUBLIC = 'BEaG67kHuMGzXfGGUGh7fmk-Bl-8icOr3UgKtxLnbfkPZjACFLVcZxAeLonizLLM-PNqxJ0vmH8KOB5zjbVKFtE'
const FN = 'https://us-central1-blitz-ksa.cloudfunctions.net'

export interface PushPrefs { minutesBefore: number; prayers: string[] }
export interface PushLoc { lat: number; lng: number; tz: string }

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export type EnableStatus = 'ok' | 'denied' | 'unsupported' | 'error'
export interface EnableResult { status: EnableStatus; detail?: string }

export async function enablePush(loc: PushLoc, locale: string, prefs: PushPrefs): Promise<EnableResult> {
  if (!('serviceWorker' in navigator)) return { status: 'unsupported', detail: 'no service worker support' }
  if (!('PushManager' in window)) return { status: 'unsupported', detail: 'no Push API' }
  if (!('Notification' in window)) return { status: 'unsupported', detail: 'no Notification API' }

  let perm: NotificationPermission
  try {
    perm = await Notification.requestPermission()
  } catch (e) {
    return { status: 'error', detail: `requestPermission: ${errStr(e)}` }
  }
  if (perm !== 'granted') return { status: 'denied', detail: `permission: ${perm}` }

  let reg: ServiceWorkerRegistration
  try {
    // Don't wait forever if the SW never activates.
    reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('service worker not ready (10s)')), 10000)),
    ])
  } catch (e) {
    return { status: 'error', detail: errStr(e) }
  }
  if (!reg.pushManager) return { status: 'error', detail: 'no pushManager on registration' }

  let sub: PushSubscription
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
    })
  } catch (e) {
    return { status: 'error', detail: `subscribe: ${errStr(e)}` }
  }

  try {
    const res = await fetch(`${FN}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub, lat: loc.lat, lng: loc.lng, tz: loc.tz, locale, prefs }),
    })
    if (!res.ok) return { status: 'error', detail: `server HTTP ${res.status}` }
  } catch (e) {
    return { status: 'error', detail: `network/CORS: ${errStr(e)}` }
  }
  return { status: 'ok' }
}

function errStr(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  return String(e)
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  try {
    await fetch(`${FN}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
  } catch { /* ignore */ }
  try { await sub.unsubscribe() } catch { /* ignore */ }
}
