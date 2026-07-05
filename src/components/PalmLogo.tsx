// Stylized palm-tree brandmark — symmetric fronds radiating from a short trunk,
// in the spirit of the "Made in Saudi" palm. Single path, inherits `currentColor`.
const PALM =
  'M32 31 Q35.4 16.96 32 4 Q28.6 16.96 32 31 Z'
  + ' M32 31 Q41.57 21.22 44.75 8.92 Q35.69 17.82 32 31 Z'
  + ' M32 31 Q28.31 17.82 19.25 8.92 Q22.43 21.22 32 31 Z'
  + ' M32 31 Q44.18 27.66 52.35 19.25 Q40.98 22.12 32 31 Z'
  + ' M32 31 Q23.02 22.12 11.65 19.25 Q19.82 27.66 32 31 Z'
  + ' M32 31 Q42.49 34.55 52.47 32.07 Q42.8 28.56 32 31 Z'
  + ' M32 31 Q21.2 28.56 11.53 32.07 Q21.51 34.55 32 31 Z'
  + ' M30.4 30 Q31.4 42 30.4 54 L33.6 54 Q34.6 42 33.6 30 Z'

export function PalmLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 58" className={className} fill="currentColor" role="img" aria-hidden="true">
      <path d={PALM} />
    </svg>
  )
}

/** The raw path — reused by the favicon/PWA icon build. */
export const PALM_PATH = PALM
