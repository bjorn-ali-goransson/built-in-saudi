import type { Tool } from './types'
import { imageCompressorTool } from './image-compressor/meta'
import { imageFormatConverterTool } from './image-format-converter/meta'
import { imageCropperTool } from './image-cropper/meta'
import { imagesToPdfTool } from './images-to-pdf/meta'
import { pdfMergeTool } from './pdf-merge/meta'
import { pdfSplitTool } from './pdf-split/meta'
import { pdfSignTool } from './pdf-sign/meta'
import { pdfFillTool } from './pdf-fill/meta'
import { pdfEditTool } from './pdf-edit/meta'
import { pdfCompressTool } from './pdf-compress/meta'
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
import { cvGeneratorTool } from './cv-generator/meta'
import { linkShortenerTool } from './link-shortener/meta'
import { callsTool } from './calls/meta'
import { promptAnalyzerTool } from './prompt-analyzer/meta'
import { regexTesterTool } from './regex-tester/meta'
import { jwtDecoderTool } from './jwt-decoder/meta'
import { cronExplainerTool } from './cron-explainer/meta'
import { textDiffTool } from './text-diff/meta'
import { unixTimestampTool } from './unix-timestamp/meta'
import { urlEncoderTool } from './url-encoder/meta'
import { baseConverterTool } from './base-converter/meta'
import { csvJsonTool } from './csv-json/meta'
import { listToolsTool } from './list-tools/meta'
import { colorContrastTool } from './color-contrast/meta'
import { loanCalculatorTool } from './loan-calculator/meta'
import { percentageCalculatorTool } from './percentage-calculator/meta'
import { splitBillTool } from './split-bill/meta'
import { aspectRatioTool } from './aspect-ratio/meta'
import { pomodoroTool } from './pomodoro/meta'
import { endOfServiceTool } from './end-of-service/meta'
import { zakatCalculatorTool } from './zakat-calculator/meta'
import { ageCalculatorTool } from './age-calculator/meta'
import { workingDaysTool } from './working-days/meta'
import { cubicBezierTool } from './cubic-bezier/meta'
import { boxShadowTool } from './box-shadow/meta'
import { gradientGeneratorTool } from './gradient-generator/meta'
import { ipSubnetTool } from './ip-subnet/meta'
import { userAgentTool } from './user-agent/meta'
import { readabilityTool } from './readability/meta'
import { randomPickerTool } from './random-picker/meta'
import { diceRollerTool } from './dice-roller/meta'
import { countdownTool } from './countdown/meta'
import { typingTestTool } from './typing-test/meta'
import { imageToAsciiTool } from './image-to-ascii/meta'
import { memeGeneratorTool } from './meme-generator/meta'
import { faviconGeneratorTool } from './favicon-generator/meta'
import { steganographyTool } from './steganography/meta'
import { screenRecorderTool } from './screen-recorder/meta'
import { photoBoothTool } from './photo-booth/meta'
import { imageRedactTool } from './image-redact/meta'
import { fileEncryptTool } from './file-encrypt/meta'
import { metaTagsTool } from './meta-tags/meta'
import { robotsTxtTool } from './robots-txt/meta'
import { gitignoreTool } from './gitignore/meta'
import { jsonToTypesTool } from './json-to-types/meta'
import { writerTool } from './writer/meta'
import { flashcardsTool } from './flashcards/meta'
import { kanbanTool } from './kanban/meta'
import { tierListTool } from './tier-list/meta'
import { readmeGeneratorTool } from './readme-generator/meta'
import { markdownTableTool } from './markdown-table/meta'
import { fakeDataTool } from './fake-data/meta'
import { slugifyTool } from './slugify/meta'

/**
 * The tool catalog. Stable/beta tools render inside the app at /tools/:id.
 * "coming-soon" entries advertise the roadmap and are not yet routable.
 *
 * Order here is the order shown on the home catalog.
 */
export const tools: Tool[] = [
  bookWithMeTool,
  callsTool,
  promptAnalyzerTool,
  regexTesterTool,
  jwtDecoderTool,
  cronExplainerTool,
  textDiffTool,
  unixTimestampTool,
  urlEncoderTool,
  baseConverterTool,
  csvJsonTool,
  listToolsTool,
  colorContrastTool,
  loanCalculatorTool,
  percentageCalculatorTool,
  splitBillTool,
  aspectRatioTool,
  pomodoroTool,
  endOfServiceTool,
  zakatCalculatorTool,
  ageCalculatorTool,
  workingDaysTool,
  cubicBezierTool,
  boxShadowTool,
  gradientGeneratorTool,
  ipSubnetTool,
  userAgentTool,
  metaTagsTool,
  robotsTxtTool,
  gitignoreTool,
  jsonToTypesTool,
  readmeGeneratorTool,
  markdownTableTool,
  fakeDataTool,
  readabilityTool,
  slugifyTool,
  writerTool,
  flashcardsTool,
  kanbanTool,
  randomPickerTool,
  diceRollerTool,
  countdownTool,
  typingTestTool,
  tierListTool,
  imageToAsciiTool,
  memeGeneratorTool,
  faviconGeneratorTool,
  steganographyTool,
  imageRedactTool,
  photoBoothTool,
  screenRecorderTool,
  fileEncryptTool,
  cvGeneratorTool,
  linkShortenerTool,
  qrCodeTool,
  imageCompressorTool,
  imageFormatConverterTool,
  imageCropperTool,
  imagesToPdfTool,
  pdfMergeTool,
  pdfSplitTool,
  pdfSignTool,
  pdfFillTool,
  pdfEditTool,
  pdfCompressTool,
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
