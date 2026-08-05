// WMO weather interpretation codes (the standard Open-Meteo returns).
export type Sky = 'clear' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

const TABLE: Record<number, { sky: Sky; en: string; ar: string }> = {
  0: { sky: 'clear', en: 'Clear', ar: 'صحو' },
  1: { sky: 'clear', en: 'Mostly clear', ar: 'صحو غالبًا' },
  2: { sky: 'cloud', en: 'Partly cloudy', ar: 'غائم جزئيًا' },
  3: { sky: 'cloud', en: 'Overcast', ar: 'غائم' },
  45: { sky: 'fog', en: 'Fog', ar: 'ضباب' },
  48: { sky: 'fog', en: 'Freezing fog', ar: 'ضباب متجمد' },
  51: { sky: 'drizzle', en: 'Light drizzle', ar: 'رذاذ خفيف' },
  53: { sky: 'drizzle', en: 'Drizzle', ar: 'رذاذ' },
  55: { sky: 'drizzle', en: 'Heavy drizzle', ar: 'رذاذ غزير' },
  56: { sky: 'drizzle', en: 'Freezing drizzle', ar: 'رذاذ متجمد' },
  57: { sky: 'drizzle', en: 'Freezing drizzle', ar: 'رذاذ متجمد' },
  61: { sky: 'rain', en: 'Light rain', ar: 'مطر خفيف' },
  63: { sky: 'rain', en: 'Rain', ar: 'مطر' },
  65: { sky: 'rain', en: 'Heavy rain', ar: 'مطر غزير' },
  66: { sky: 'rain', en: 'Freezing rain', ar: 'مطر متجمد' },
  67: { sky: 'rain', en: 'Freezing rain', ar: 'مطر متجمد' },
  71: { sky: 'snow', en: 'Light snow', ar: 'ثلج خفيف' },
  73: { sky: 'snow', en: 'Snow', ar: 'ثلج' },
  75: { sky: 'snow', en: 'Heavy snow', ar: 'ثلج كثيف' },
  77: { sky: 'snow', en: 'Snow grains', ar: 'حبيبات ثلج' },
  80: { sky: 'rain', en: 'Light showers', ar: 'زخات خفيفة' },
  81: { sky: 'rain', en: 'Showers', ar: 'زخات مطر' },
  82: { sky: 'rain', en: 'Violent showers', ar: 'زخات عنيفة' },
  85: { sky: 'snow', en: 'Snow showers', ar: 'زخات ثلج' },
  86: { sky: 'snow', en: 'Heavy snow showers', ar: 'زخات ثلج كثيفة' },
  95: { sky: 'storm', en: 'Thunderstorm', ar: 'عاصفة رعدية' },
  96: { sky: 'storm', en: 'Thunderstorm with hail', ar: 'عاصفة رعدية مع برد' },
  99: { sky: 'storm', en: 'Thunderstorm with hail', ar: 'عاصفة رعدية مع برد' },
}

export function describe(code: number, locale: 'en' | 'ar'): string {
  return TABLE[code]?.[locale] ?? (locale === 'ar' ? 'غير معروف' : 'Unknown')
}
export function sky(code: number): Sky {
  return TABLE[code]?.sky ?? 'cloud'
}

// ── Dust ───────────────────────────────────────────────────────────────────
// The metric that actually matters here and that most weather apps omit.
// Bands follow the WHO / common AQI breakpoints for PM10 (µg/m³).
export type DustBand = 'good' | 'moderate' | 'poor' | 'severe'

export function dustBand(pm10: number | null): DustBand | null {
  if (pm10 === null || !Number.isFinite(pm10)) return null
  if (pm10 < 50) return 'good'
  if (pm10 < 150) return 'moderate'
  if (pm10 < 350) return 'poor'
  return 'severe'
}

export const DUST_LABEL: Record<DustBand, { en: string; ar: string }> = {
  good: { en: 'Clear air', ar: 'هواء نقي' },
  moderate: { en: 'Some dust', ar: 'غبار خفيف' },
  poor: { en: 'Dusty', ar: 'غبار' },
  severe: { en: 'Heavy dust', ar: 'غبار كثيف' },
}

export const DUST_TONE: Record<DustBand, string> = {
  good: 'text-green-700',
  moderate: 'text-ink',
  poor: 'text-gold-500',
  severe: 'text-gold-500 font-semibold',
}

// ── UV ─────────────────────────────────────────────────────────────────────
export function uvLabel(uv: number, locale: 'en' | 'ar'): string {
  const bands: [number, string, string][] = [
    [3, 'Low', 'منخفض'], [6, 'Moderate', 'معتدل'], [8, 'High', 'مرتفع'],
    [11, 'Very high', 'مرتفع جدًا'], [Infinity, 'Extreme', 'شديد'],
  ]
  for (const [max, en, ar] of bands) if (uv < max) return locale === 'ar' ? ar : en
  return locale === 'ar' ? 'شديد' : 'Extreme'
}
