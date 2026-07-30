// Live location sharing on the call's shared stage (#235). A new form of sharing
// alongside whiteboard / screen / files: each participant can broadcast their live
// GPS position (P2P over the data channel, never the server), and anyone can drop
// labelled pins.
//
// Deliberately NO map tiles. A slippy map means fetching tiles from a tile server,
// which would leak everyone's location to a third party and add a heavy dep — both
// against the brand. Instead this draws a tile-less, self-contained schematic: an
// isotropic (undistorted) projection of the shared points, auto-fitted with a real
// metric scale bar, so you can see where everyone is relative to each other and to
// the pins. A per-row "open in maps" link hands off to the user's own map app when
// they actually want turn-by-turn — a user gesture, not an automatic request.
import { GlobeIcon, TrashIcon, CompassIcon } from '../../components/icons'
import { Button } from '../../components/ui'
import type { Str } from './strings'

export interface GeoPoint { id: string; lat: number; lng: number; acc?: number; label: string; self?: boolean }
export interface GeoPin { id: string; lat: number; lng: number; label?: string }

const M_PER_DEG_LAT = 110540
const M_PER_DEG_LNG = 111320

function fmtDist(m: number, locale: 'en' | 'ar'): string {
  const nf = new Intl.NumberFormat(locale)
  return m >= 1000 ? `${nf.format(Math.round(m / 100) / 10)} km` : `${nf.format(Math.round(m))} m`
}

export function LocationMap({ locale, s, points, pins, sharing, onToggleShare, onDropPin, onRemovePin }: {
  locale: 'en' | 'ar'; s: Str
  points: GeoPoint[]; pins: GeoPin[]
  sharing: boolean; onToggleShare: () => void
  onDropPin: (lat: number, lng: number) => void; onRemovePin: (id: string) => void
}) {
  const all: { lat: number; lng: number }[] = [...points, ...pins]
  const has = all.length > 0
  const midLat = has ? all.reduce((a, p) => a + p.lat, 0) / all.length : 0
  const midLng = has ? all.reduce((a, p) => a + p.lng, 0) / all.length : 0
  const cos = Math.cos((midLat * Math.PI) / 180) || 1
  const mx = (lng: number) => (lng - midLng) * cos * M_PER_DEG_LNG
  const my = (lat: number) => (midLat - lat) * M_PER_DEG_LAT // north up
  // Isotropic half-span so the two axes share one metres-per-fraction scale — the
  // plot never distorts distances. Floored so a lone point isn't infinitely zoomed.
  let R = 25
  for (const p of all) R = Math.max(R, Math.abs(mx(p.lng)), Math.abs(my(p.lat)))
  const half = R * 1.3
  const fx = (lng: number) => 0.5 + mx(lng) / (2 * half)
  const fy = (lat: number) => 0.5 + my(lat) / (2 * half)
  const toGeo = (px: number, py: number) => ({
    lng: midLng + ((px - 0.5) * 2 * half) / (cos * M_PER_DEG_LNG),
    lat: midLat - ((py - 0.5) * 2 * half) / M_PER_DEG_LAT,
  })
  function drop(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    if (px < 0 || px > 1 || py < 0 || py > 1) return
    const g = toGeo(px, py)
    onDropPin(g.lat, g.lng)
  }
  // Scale bar: the widest "nice" distance that fits in ~40% of the view.
  const nice = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  const budget = 2 * half * 0.4
  let barM = nice[0]
  for (const n of nice) if (n <= budget) barM = n
  const barFrac = Math.min(0.9, barM / (2 * half))
  const mapsUrl = (lat: number, lng: number) => `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=17/${lat.toFixed(5)}/${lng.toFixed(5)}`

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-[var(--surface)]" data-testid="call-location">
      {/* header: share toggle + pin hint */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-[color:var(--line)] bg-[var(--bg)]">
        <Button variant={sharing ? 'default' : 'primary'} onClick={onToggleShare} data-testid="call-loc-share" className="!py-1.5 !px-3 text-[0.82rem]">
          <CompassIcon className="w-4 h-4" /> {sharing ? s.locStop : s.locShare}
        </Button>
        <span className="text-[0.78rem] text-ink-faint">{s.locPinHint}</span>
      </div>
      {/* the plot */}
      <div className="relative flex-1 min-h-0 overflow-hidden cursor-crosshair
                      [background:radial-gradient(circle,color-mix(in_srgb,var(--ink)_10%,transparent)_1px,transparent_1px)] [background-size:24px_24px]"
        onClick={drop} data-testid="call-loc-plot">
        {!has && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center pointer-events-none">
            <p className="max-w-[22rem] text-[0.9rem] text-ink-faint leading-relaxed">{s.locNobody}</p>
          </div>
        )}
        {/* pins */}
        {pins.map((p) => (
          <button key={p.id} type="button" onClick={(e) => { e.stopPropagation(); onRemovePin(p.id) }} title={s.remove} data-testid="call-loc-pin"
            className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center group/pin bg-transparent border-0 cursor-pointer p-0"
            style={{ left: `${fx(p.lng) * 100}%`, top: `${fy(p.lat) * 100}%` }}>
            <span className="w-3.5 h-3.5 rotate-45 rounded-[2px] bg-[var(--gold-500)] border border-white shadow" />
            {p.label && <span className="mt-0.5 max-w-[8rem] truncate rounded bg-black/55 px-1 text-[0.62rem] text-sand-100">{p.label}</span>}
          </button>
        ))}
        {/* participants */}
        {points.map((pt) => (
          <span key={pt.id} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${fx(pt.lng) * 100}%`, top: `${fy(pt.lat) * 100}%` }} data-testid="call-loc-dot">
            <span className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow ${pt.self ? 'bg-green-600 ring-2 ring-green-400/50' : 'bg-[var(--gold-500)]'}`} />
            <span className="mt-0.5 max-w-[8rem] truncate rounded bg-black/55 px-1 text-[0.66rem] text-sand-100"><bdi>{pt.label}</bdi></span>
          </span>
        ))}
        {/* scale bar */}
        {has && (
          <div className="absolute bottom-2 start-2 flex flex-col items-start gap-0.5 pointer-events-none">
            <div className="h-1.5 border-x-2 border-b-2 border-[color:var(--ink)]" style={{ width: `calc(${barFrac} * (100% ))`, minWidth: 12 }} />
            <span className="text-[0.62rem] font-mono text-ink-soft">{fmtDist(barM, locale)}</span>
          </div>
        )}
      </div>
      {/* list: open in maps per point; remove per pin */}
      {(points.length > 0 || pins.length > 0) && (
        <div className="shrink-0 max-h-[30%] overflow-y-auto border-t border-[color:var(--line)] bg-[var(--surface)] p-2 flex flex-col gap-0.5" data-testid="call-loc-list">
          {points.map((pt) => (
            <div key={pt.id} className="flex items-center gap-2 px-1.5 py-1 text-[0.82rem]">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${pt.self ? 'bg-green-600' : 'bg-[var(--gold-500)]'}`} />
              <span className="flex-1 min-w-0 truncate text-ink"><bdi>{pt.label}</bdi></span>
              <a href={mapsUrl(pt.lat, pt.lng)} target="_blank" rel="noopener noreferrer" data-testid="call-loc-open"
                className="inline-flex items-center gap-1 text-[0.75rem] text-green-700 hover:text-green-800 no-underline shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5"><GlobeIcon />{s.locOpenMaps}</a>
            </div>
          ))}
          {pins.map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-1.5 py-1 text-[0.82rem]">
              <span className="w-2.5 h-2.5 rotate-45 rounded-[2px] bg-[var(--gold-500)] shrink-0" />
              <span className="flex-1 min-w-0 truncate text-ink-soft"><bdi>{p.label || s.location}</bdi></span>
              <a href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[0.75rem] text-green-700 hover:text-green-800 no-underline shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5"><GlobeIcon />{s.locOpenMaps}</a>
              <button type="button" onClick={() => onRemovePin(p.id)} title={s.remove} aria-label={s.remove} data-testid="call-loc-pin-remove"
                className="grid place-items-center w-7 h-7 rounded bg-transparent border-0 text-ink-faint hover:text-[var(--danger)] cursor-pointer shrink-0 [&_svg]:w-3.5 [&_svg]:h-3.5"><TrashIcon /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
