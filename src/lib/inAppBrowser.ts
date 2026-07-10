// Detect embedded "in-app" browsers (LinkedIn, Instagram, Facebook, etc.). Their
// WebViews often lag on modern JS APIs and block features, breaking things like
// pdf.js. Returns a friendly app name, or null for a normal browser.
const APPS: [RegExp, string][] = [
  [/LinkedInApp/i, 'LinkedIn'],
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB/i, 'Facebook'],
  [/Twitter/i, 'X'],
  [/\bLine\//i, 'Line'],
  [/musical_ly|Bytedance|TikTok/i, 'TikTok'],
  [/Snapchat/i, 'Snapchat'],
  [/MicroMessenger/i, 'WeChat'],
]

export function inAppBrowser(): string | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent || ''
  for (const [re, name] of APPS) if (re.test(ua)) return name
  return null
}
