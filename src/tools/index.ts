import type { Tool } from './types'
import { qrCodeTool } from './qr-code/meta'
import { prayerTimesTool } from './prayer-times/meta'
import { hijriCalendarTool } from './hijri-calendar/meta'
import { islamicCalendarTool } from './islamic-calendar/meta'
import { istikharaTool } from './istikhara/meta'
import { adhkarTool } from './adhkar/meta'
import { hisnAlMuslimTool } from './hisn-al-muslim/meta'
import { qiblaTool } from './qibla/meta'
import { passwordGeneratorTool } from './password-generator/meta'
import { uuidGeneratorTool } from './uuid-generator/meta'
import { wordCounterTool } from './word-counter/meta'
import { languageDetectTool } from './language-detect/meta'
import { loremTool } from './lorem/meta'
import { base64Tool } from './base64/meta'
import { dateDiffTool } from './date-diff/meta'
import { zipInspectorTool } from './zip-inspector/meta'
import { metadataTool } from './metadata/meta'
import { ImageIcon, PaletteIcon, RulerIcon, BracesIcon } from '../components/icons'

/**
 * The tool catalog. Stable/beta tools render inside the app at /tools/:id.
 * "coming-soon" entries advertise the roadmap and are not yet routable.
 *
 * Order here is the order shown on the home catalog.
 */
export const tools: Tool[] = [
  qrCodeTool,
  prayerTimesTool,
  islamicCalendarTool,
  adhkarTool,
  hisnAlMuslimTool,
  istikharaTool,
  hijriCalendarTool,
  qiblaTool,
  passwordGeneratorTool,
  uuidGeneratorTool,
  wordCounterTool,
  languageDetectTool,
  loremTool,
  base64Tool,
  dateDiffTool,
  zipInspectorTool,
  metadataTool,

  // ── Roadmap ──────────────────────────────────────────────
  {
    id: 'image-compressor',
    name: 'Image Compressor',
    tagline: 'Shrink JPG & PNG without uploading them anywhere.',
    description: 'Compress and resize images on-device — your files never leave your computer.',
    category: 'Images',
    keywords: ['image', 'compress', 'optimize', 'resize', 'jpg', 'png'],
    status: 'coming-soon',
    Icon: ImageIcon,
    ar: {
      name: 'ضاغط الصور',
      tagline: 'صغّر حجم صور JPG وPNG دون رفعها إلى أي مكان.',
      description: 'اضغط الصور وغيّر أبعادها على جهازك — ملفاتك لا تغادر حاسوبك.',
    },
  },
  {
    id: 'color-tools',
    name: 'Color Picker & Palettes',
    tagline: 'Pick, convert and build palettes (HEX · RGB · HSL).',
    description: 'Pick colours, convert between formats and generate harmonious palettes.',
    category: 'Design',
    keywords: ['color', 'colour', 'palette', 'hex', 'rgb', 'hsl'],
    status: 'coming-soon',
    Icon: PaletteIcon,
    ar: {
      name: 'منتقي الألوان واللوحات',
      tagline: 'اختر الألوان وحوّلها وابنِ لوحات (HEX · RGB · HSL).',
      description: 'اختر الألوان وحوّل بين الصيغ وأنشئ لوحات ألوان متناسقة.',
    },
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    tagline: 'Length, weight, temperature, data and more.',
    description: 'Convert between everyday units quickly and accurately.',
    category: 'Converters',
    keywords: ['convert', 'unit', 'length', 'weight', 'temperature'],
    status: 'coming-soon',
    Icon: RulerIcon,
    ar: {
      name: 'محوّل الوحدات',
      tagline: 'الطول والوزن والحرارة والبيانات والمزيد.',
      description: 'حوّل بين الوحدات اليومية بسرعة ودقة.',
    },
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    tagline: 'Format, validate and minify JSON instantly.',
    description: 'Prettify, validate and minify JSON with clear error reporting.',
    category: 'Developer',
    keywords: ['json', 'format', 'validate', 'minify', 'pretty'],
    status: 'coming-soon',
    Icon: BracesIcon,
    ar: {
      name: 'مُنسّق JSON',
      tagline: 'نسّق JSON وتحقّق منه واختصره فورًا.',
      description: 'نسّق JSON وتحقّق من صحته واختصره مع إبلاغ واضح عن الأخطاء.',
    },
  },
]

export function getTool(id: string | undefined): Tool | undefined {
  if (!id) return undefined
  return tools.find((t) => t.id === id)
}

export const liveTools = tools.filter((t) => t.status !== 'coming-soon')
export const comingSoonTools = tools.filter((t) => t.status === 'coming-soon')
