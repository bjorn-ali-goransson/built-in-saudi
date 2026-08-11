export interface WifiFields {
  ssid: string
  password: string
  encryption: 'WPA' | 'WEP' | 'nopass'
  hidden: boolean
}

export interface EmailFields {
  to: string
  subject: string
  body: string
}

/** Escape special chars per the Wi-Fi QR spec (\ ; , : " ). */
function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1')
}

/** Add https:// when the user typed a bare domain (no scheme). */
export function normalizeUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v) || /^(mailto|tel):/i.test(v)) return v
  return `https://${v}`
}

export function buildWifi(f: WifiFields): string {
  if (!f.ssid.trim()) return ''
  const parts = [
    `T:${f.encryption}`,
    `S:${escapeWifi(f.ssid)}`,
    f.encryption !== 'nopass' ? `P:${escapeWifi(f.password)}` : '',
    f.hidden ? 'H:true' : '',
  ].filter(Boolean)
  return `WIFI:${parts.join(';')};;`
}

export function buildEmail(f: EmailFields): string {
  if (!f.to.trim()) return ''
  const params = new URLSearchParams()
  if (f.subject.trim()) params.set('subject', f.subject)
  if (f.body.trim()) params.set('body', f.body)
  const query = params.toString()
  return `mailto:${f.to.trim()}${query ? `?${query}` : ''}`
}

export function buildPhone(raw: string): string {
  const v = raw.replace(/[^\d+]/g, '')
  return v ? `tel:${v}` : ''
}
