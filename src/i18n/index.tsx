import { createContext, useContext, type ReactNode } from 'react'
import { en, type Dict } from './en'
import { ar } from './ar'
import type { Tool } from '../tools/types'

export type Locale = 'en' | 'ar'
export const LOCALES: Locale[] = ['en', 'ar']
export const DEFAULT_LOCALE: Locale = 'en'

export const dicts: Record<Locale, Dict> = { en, ar }

export function isLocale(x: unknown): x is Locale {
  return x === 'en' || x === 'ar'
}

/**
 * Detect the user agent's preferred locale, erring toward English.
 * We only pick Arabic when the TOP language preference is Arabic — if Arabic is
 * merely present but not primary, we lean English (per product decision).
 */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  const primary = (langs[0] || '').toLowerCase()
  return primary.startsWith('ar') ? 'ar' : 'en'
}

// ── Persistence ─────────────────────────────────────────────
const PREF_KEY = 'bis-locale'
const DISMISS_KEY = 'bis-lang-hint-dismissed'

export function getStoredLocale(): Locale | null {
  try {
    const v = localStorage.getItem(PREF_KEY)
    return isLocale(v) ? v : null
  } catch {
    return null
  }
}
export function setStoredLocale(l: Locale) {
  try { localStorage.setItem(PREF_KEY, l) } catch { /* ignore */ }
}
export function isHintDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}
export function dismissHint() {
  try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
}

// ── Path helpers ────────────────────────────────────────────
/** Build a locale-prefixed path. `sub` is like '' or '/tools/qr-code'. */
export function localePath(locale: Locale, sub = ''): string {
  return `/${locale}${sub}`
}

/** Swap the leading locale segment of a pathname to `to` (keeps the rest). */
export function swapLocaleInPath(pathname: string, to: Locale): string {
  const parts = pathname.split('/')
  // parts[0] === '' (leading slash), parts[1] === current locale (maybe)
  if (isLocale(parts[1])) {
    parts[1] = to
    return parts.join('/') || `/${to}`
  }
  return `/${to}${pathname === '/' ? '' : pathname}`
}

// ── Tool localisation ───────────────────────────────────────
const CATEGORY_LABELS: Record<string, Record<Locale, string>> = {
  Generators: { en: 'Generators', ar: 'مولّدات' },
  Images: { en: 'Images', ar: 'صور' },
  Design: { en: 'Design', ar: 'تصميم' },
  Converters: { en: 'Converters', ar: 'محوّلات' },
  Developer: { en: 'Developer', ar: 'أدوات المطوّرين' },
  Text: { en: 'Text', ar: 'نصوص' },
  Calculators: { en: 'Calculators', ar: 'حاسبات' },
}

export function categoryLabel(category: string, locale: Locale): string {
  return CATEGORY_LABELS[category]?.[locale] ?? category
}

export interface LocalizedTool {
  name: string
  tagline: string
  description: string
  category: string
}

/** Localise a tool's display fields, falling back to English when AR is missing. */
export function localizeTool(tool: Tool, locale: Locale): LocalizedTool {
  const t = locale === 'ar' ? tool.ar : undefined
  return {
    name: t?.name ?? tool.name,
    tagline: t?.tagline ?? tool.tagline,
    description: t?.description ?? tool.description,
    category: categoryLabel(tool.category, locale),
  }
}

// ── Context ─────────────────────────────────────────────────
interface LocaleContextValue {
  locale: Locale
  t: Dict
  dir: 'ltr' | 'rtl'
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: en,
  dir: 'ltr',
})

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = dicts[locale]
  return (
    <LocaleContext.Provider value={{ locale, t, dir: t.dir }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
