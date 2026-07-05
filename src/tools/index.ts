import type { Tool } from './types'
import { imageCompressorTool } from './image-compressor/meta'
import { imageFormatConverterTool } from './image-format-converter/meta'
import { imageCropperTool } from './image-cropper/meta'
import { imagesToPdfTool } from './images-to-pdf/meta'
import { pdfMergeTool } from './pdf-merge/meta'
import { pdfSplitTool } from './pdf-split/meta'
import { invoiceGeneratorTool } from './invoice-generator/meta'
import { colorToolsTool } from './color-tools/meta'
import { qrCodeTool } from './qr-code/meta'
import { prayerTimesTool } from './prayer-times/meta'
import { hijriCalendarTool } from './hijri-calendar/meta'
import { islamicCalendarTool } from './islamic-calendar/meta'
import { istikharaTool } from './istikhara/meta'
import { adhkarTool } from './adhkar/meta'
import { hisnAlMuslimTool } from './hisn-al-muslim/meta'
import { ibanValidatorTool } from './iban-validator/meta'
import { tafqeetTool } from './tafqeet/meta'
import { qiblaTool } from './qibla/meta'
import { passwordGeneratorTool } from './password-generator/meta'
import { uuidGeneratorTool } from './uuid-generator/meta'
import { wordCounterTool } from './word-counter/meta'
import { caseConverterTool } from './case-converter/meta'
import { poetryTool } from './poetry/meta'
import { languageDetectTool } from './language-detect/meta'
import { hashGeneratorTool } from './hash-generator/meta'
import { loremTool } from './lorem/meta'
import { jsonFormatterTool } from './json-formatter/meta'
import { unitConverterTool } from './unit-converter/meta'
import { base64Tool } from './base64/meta'
import { vatCalculatorTool } from './vat-calculator/meta'
import { dateDiffTool } from './date-diff/meta'
import { zipInspectorTool } from './zip-inspector/meta'
import { metadataTool } from './metadata/meta'
import { bookWithMeTool } from './book-with-me/meta'

/**
 * The tool catalog. Stable/beta tools render inside the app at /tools/:id.
 * "coming-soon" entries advertise the roadmap and are not yet routable.
 *
 * Order here is the order shown on the home catalog.
 */
export const tools: Tool[] = [
  bookWithMeTool,
  qrCodeTool,
  imageCompressorTool,
  imageFormatConverterTool,
  imageCropperTool,
  imagesToPdfTool,
  pdfMergeTool,
  pdfSplitTool,
  invoiceGeneratorTool,
  prayerTimesTool,
  islamicCalendarTool,
  adhkarTool,
  hisnAlMuslimTool,
  istikharaTool,
  hijriCalendarTool,
  ibanValidatorTool,
  tafqeetTool,
  qiblaTool,
  passwordGeneratorTool,
  uuidGeneratorTool,
  wordCounterTool,
  caseConverterTool,
  poetryTool,
  languageDetectTool,
  hashGeneratorTool,
  loremTool,
  jsonFormatterTool,
  unitConverterTool,
  base64Tool,
  vatCalculatorTool,
  dateDiffTool,
  zipInspectorTool,
  metadataTool,
  colorToolsTool,

]

export function getTool(id: string | undefined): Tool | undefined {
  if (!id) return undefined
  return tools.find((t) => t.id === id)
}

export const liveTools = tools.filter((t) => t.status !== 'coming-soon')
export const comingSoonTools = tools.filter((t) => t.status === 'coming-soon')
