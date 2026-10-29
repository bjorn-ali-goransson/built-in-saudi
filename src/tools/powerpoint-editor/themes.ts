// The Design tab's themes: a colour scheme and two fonts. Applying one changes
// the deck's theme only — every shape that uses a theme SLOT recolours itself,
// which is the reason slots are kept rather than resolved to hex on import.
import type { Theme } from './model'

const t = (name: string, c: string[], major: string, minor: string): Theme => ({
  name,
  colors: { dk1: c[0], lt1: c[1], dk2: c[2], lt2: c[3], accent1: c[4], accent2: c[5], accent3: c[6], accent4: c[7], accent5: c[8], accent6: c[9], hlink: c[10], folHlink: c[11] },
  fonts: { major, minor },
})

export const THEMES: Theme[] = [
  t('Office', ['#000000', '#ffffff', '#44546a', '#e7e6e6', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#0563c1', '#954f72'], 'Calibri Light', 'Calibri'),
  t('Najdi', ['#1f2a24', '#f7f2e8', '#0b4f3a', '#e9dfc9', '#0b6e4f', '#b07d2b', '#7a5c3e', '#c9a54a', '#4f7f6a', '#a3472a', '#0b6e4f', '#7a5c3e'], 'Georgia', 'IBM Plex Sans Arabic'),
  t('Ink', ['#111418', '#ffffff', '#2b3440', '#eef1f4', '#2f6fed', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b', '#2f6fed', '#8b5cf6'], 'Arial', 'Arial'),
  t('Ocean', ['#0c2233', '#ffffff', '#16425b', '#e6f1f6', '#0f7ea6', '#2bb0a6', '#f2a541', '#5c80bc', '#93c5d8', '#e76f51', '#0f7ea6', '#5c80bc'], 'Trebuchet MS', 'Verdana'),
  t('Sunset', ['#2d1b2e', '#fffaf5', '#5b2a3f', '#fbe9dd', '#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#9b5de5', '#c0392b', '#e76f51', '#9b5de5'], 'Georgia', 'Tahoma'),
  t('Mono', ['#1a1a1a', '#ffffff', '#4d4d4d', '#f2f2f2', '#1a1a1a', '#595959', '#8c8c8c', '#bfbfbf', '#262626', '#737373', '#1a1a1a', '#595959'], 'Times New Roman', 'Arial'),
  // A dark theme: the light slot IS the dark background, so text written in dk1 reads light.
  t('Midnight', ['#f2f4f8', '#12161f', '#c9d1e1', '#1d2433', '#7aa2f7', '#bb9af7', '#9ece6a', '#e0af68', '#7dcfff', '#f7768e', '#7aa2f7', '#bb9af7'], 'Segoe UI', 'Segoe UI'),
  t('Desert', ['#3b2a1a', '#fbf6ee', '#7a4b24', '#f1e4cf', '#c46a2b', '#d9a441', '#8a6d3b', '#5d7b4f', '#b5543c', '#3f6b8a', '#c46a2b', '#8a6d3b'], 'Palatino Linotype', 'Candara'),
]

export const FONT_PAIRS: { major: string; minor: string }[] = [
  { major: 'Calibri Light', minor: 'Calibri' }, { major: 'Georgia', minor: 'IBM Plex Sans Arabic' }, { major: 'Arial', minor: 'Arial' },
  { major: 'Times New Roman', minor: 'Arial' }, { major: 'Trebuchet MS', minor: 'Verdana' }, { major: 'Amiri', minor: 'Noto Naskh Arabic' }, { major: 'Tahoma', minor: 'Tahoma' },
]
