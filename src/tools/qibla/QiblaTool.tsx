import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { reverseGeocode } from '../prayer-times/geo'

// The Kaaba, Makkah.
const KAABA = { lat: 21.4224779, lng: 39.8251832 }
const RAD = Math.PI / 180

const STR = {
  en: {
    locate: 'Find Qibla', locating: 'Finding your location…',
    geoError: 'Couldn’t get your location — please allow location access.',
    bearing: 'Qibla direction', distance: 'Distance to Makkah',
    fromNorth: 'from North', km: 'km',
    calibrate: 'Point the top of your phone forward and rotate until the arrow points up.',
    enableCompass: 'Enable live compass', compassOn: 'Live compass on',
    noCompass: 'Live compass isn’t available on this device — use the degrees with a real compass.',
    hint: 'Hold your phone flat.',
  },
  ar: {
    locate: 'حدّد القبلة', locating: 'جارٍ تحديد موقعك…',
    geoError: 'تعذّر تحديد موقعك — يرجى السماح بالوصول إلى الموقع.',
    bearing: 'اتجاه القبلة', distance: 'المسافة إلى مكة',
    fromNorth: 'من الشمال', km: 'كم',
    calibrate: 'وجّه أعلى هاتفك للأمام ودوّر حتى يشير السهم للأعلى.',
    enableCompass: 'تفعيل البوصلة المباشرة', compassOn: 'البوصلة المباشرة مفعّلة',
    noCompass: 'البوصلة المباشرة غير متاحة على هذا الجهاز — استخدم الدرجات مع بوصلة حقيقية.',
    hint: 'أمسك هاتفك بشكل مسطّح.',
  },
}

function qiblaBearing(lat: number, lng: number): number {
  const φ1 = lat * RAD, φ2 = KAABA.lat * RAD
  const Δλ = (KAABA.lng - lng) * RAD
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) / RAD + 360) % 360
}

function haversineKm(lat: number, lng: number): number {
  const φ1 = lat * RAD, φ2 = KAABA.lat * RAD
  const dφ = (KAABA.lat - lat) * RAD, dλ = (KAABA.lng - lng) * RAD
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function QiblaTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [place, setPlace] = useState('')
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [heading, setHeading] = useState<number | null>(null) // device compass heading (deg)
  const [compassOn, setCompassOn] = useState(false)

  const bearing = useMemo(() => (pos ? qiblaBearing(pos.lat, pos.lng) : null), [pos])
  const distance = useMemo(() => (pos ? haversineKm(pos.lat, pos.lng) : null), [pos])

  function locate() {
    setError('')
    if (!navigator.geolocation) { setError(s.geoError); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
        setLocating(false)
        reverseGeocode(p.coords.latitude, p.coords.longitude, locale).then((n) => n && setPlace(n))
      },
      () => { setError(s.geoError); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  useEffect(() => { locate() /* auto-locate on mount */; /* eslint-disable-next-line */ }, [])

  // Live compass via device orientation (needs a user gesture + permission on iOS).
  async function enableCompass() {
    interface DOE { requestPermission?: () => Promise<'granted' | 'denied'> }
    const DOEvent = window.DeviceOrientationEvent as unknown as DOE | undefined
    try {
      if (DOEvent && typeof DOEvent.requestPermission === 'function') {
        const r = await DOEvent.requestPermission()
        if (r !== 'granted') { setError(s.noCompass); return }
      }
    } catch { setError(s.noCompass); return }

    const onOrient = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      let h: number | null = null
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading
      else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha
      if (h != null) setHeading((h + 360) % 360)
    }
    window.addEventListener('deviceorientationabsolute', onOrient as EventListener)
    window.addEventListener('deviceorientation', onOrient as EventListener)
    setCompassOn(true)
  }

  // Needle angle: qibla relative to the device's current heading (or to North if no compass).
  const needle = bearing == null ? 0 : heading == null ? bearing : (bearing - heading + 360) % 360

  return (
    <div className="qibla" data-testid="qibla">
      {error && <p className="pray__geoerr" data-testid="qibla-error">{error}</p>}
      {locating && <p className="pray__locating">{s.locating}</p>}

      <div className="qibla__dial" role="img"
        aria-label={bearing != null ? `${s.bearing} ${Math.round(bearing)}° ${s.fromNorth}` : s.bearing}>
        <div className="qibla__rose" style={{ transform: heading != null ? `rotate(${-heading}deg)` : undefined }}>
          <span className="qibla__n">N</span><span className="qibla__e">E</span>
          <span className="qibla__s">S</span><span className="qibla__w">W</span>
        </div>
        <div className="qibla__needle" data-testid="qibla-needle" style={{ transform: `rotate(${needle}deg)` }}>
          <span className="qibla__kaaba" aria-hidden="true">🕋</span>
        </div>
      </div>

      {bearing != null && (
        <div className="qibla__readout">
          <div className="qibla__stat">
            <span className="qibla__stat-num" data-testid="qibla-bearing">{Math.round(bearing)}°</span>
            <span className="qibla__stat-label">{s.bearing} · {s.fromNorth}</span>
          </div>
          <div className="qibla__stat">
            <span className="qibla__stat-num" data-testid="qibla-distance">{Math.round(distance!).toLocaleString()}</span>
            <span className="qibla__stat-label">{s.distance} ({s.km})</span>
          </div>
        </div>
      )}
      {place && <p className="qibla__place" data-testid="qibla-place">{place}</p>}

      <div className="qibla__actions">
        {!compassOn ? (
          <button className="btn btn--primary" data-testid="qibla-compass" onClick={enableCompass}>{s.enableCompass}</button>
        ) : (
          <span className="qibla__compass-on">{s.compassOn}</span>
        )}
        <button className="btn" data-testid="qibla-relocate" onClick={locate}>{s.locate}</button>
      </div>
      <p className="qibla__hint">{compassOn ? s.hint : s.calibrate}</p>
    </div>
  )
}
