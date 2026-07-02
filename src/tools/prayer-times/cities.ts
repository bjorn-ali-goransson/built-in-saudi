export interface City {
  id: string
  en: string
  ar: string
  lat: number
  lng: number
  tz: string
}

// A handful of major Saudi cities. tz is Asia/Riyadh (UTC+3, no DST) for all.
export const CITIES: City[] = [
  { id: 'makkah', en: 'Makkah', ar: 'مكة المكرمة', lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh' },
  { id: 'madinah', en: 'Madinah', ar: 'المدينة المنورة', lat: 24.4686, lng: 39.6142, tz: 'Asia/Riyadh' },
  { id: 'riyadh', en: 'Riyadh', ar: 'الرياض', lat: 24.7136, lng: 46.6753, tz: 'Asia/Riyadh' },
  { id: 'jeddah', en: 'Jeddah', ar: 'جدة', lat: 21.4858, lng: 39.1925, tz: 'Asia/Riyadh' },
  { id: 'dammam', en: 'Dammam', ar: 'الدمام', lat: 26.3927, lng: 49.9777, tz: 'Asia/Riyadh' },
  { id: 'abha', en: 'Abha', ar: 'أبها', lat: 18.2164, lng: 42.5053, tz: 'Asia/Riyadh' },
  { id: 'tabuk', en: 'Tabuk', ar: 'تبوك', lat: 28.3838, lng: 36.555, tz: 'Asia/Riyadh' },
  { id: 'buraidah', en: 'Buraidah', ar: 'بريدة', lat: 26.326, lng: 43.975, tz: 'Asia/Riyadh' },
]

export const DEFAULT_CITY = CITIES[0] // Makkah
