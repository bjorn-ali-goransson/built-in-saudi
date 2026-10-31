import type { Tool } from './types'
import { imageCompressorTool } from './image-compressor/meta'
import { imageEditTool } from './image-edit/meta'
import { docScanTool } from './doc-scan/meta'
import { pdfMergeTool } from './pdf-merge/meta'
import { pdfToImagesTool } from './pdf-to-images/meta'
import { imageToTextTool } from './image-to-text/meta'
import { qrReaderTool } from './qr-reader/meta'
import { pdfSignTool } from './pdf-sign/meta'
import { pdfFillTool } from './pdf-fill/meta'
import { pdfEditTool } from './pdf-edit/meta'
import { pdfCompressTool } from './pdf-compress/meta'
import { qrCodeTool } from './qr-code/meta'
import { prayerTimesTool } from './prayer-times/meta'
import { hijriCalendarTool } from './hijri-calendar/meta'
import { islamicCalendarTool } from './islamic-calendar/meta'
import { istikharaTool } from './istikhara/meta'
import { adhkarTool } from './adhkar/meta'
import { hajjUmrahTool } from './hajj-umrah/meta'
import { hisnAlMuslimTool } from './hisn-al-muslim/meta'
import { ibanValidatorTool } from './iban-validator/meta'
import { tafqeetTool } from './tafqeet/meta'
import { qiblaTool } from './qibla/meta'
import { passwordGeneratorTool } from './password-generator/meta'
import { uuidGeneratorTool } from './uuid-generator/meta'
import { caseConverterTool } from './case-converter/meta'
import { poetryTool } from './poetry/meta'
import { languageDetectTool } from './language-detect/meta'
import { unitConverterTool } from './unit-converter/meta'
import { dateDiffTool } from './date-diff/meta'
import { bookWithMeTool } from './book-with-me/meta'
import { cvGeneratorTool } from './cv-generator/meta'
import { linkShortenerTool } from './link-shortener/meta'
import { callsTool } from './calls/meta'
import { messagesTool } from './messages/meta'
import { excelEditorTool } from './excel-editor/meta'
import { wordEditorTool } from './word-editor/meta'
import { powerpointEditorTool } from './powerpoint-editor/meta'
import { promptAnalyzerTool } from './prompt-analyzer/meta'
import { jwtDecoderTool } from './jwt-decoder/meta'
import { urlEncoderTool } from './url-encoder/meta'
import { baseConverterTool } from './base-converter/meta'
import { csvJsonTool } from './csv-json/meta'
import { splitBillTool } from './split-bill/meta'
import { zakatCalculatorTool } from './zakat-calculator/meta'
import { cubicBezierTool } from './cubic-bezier/meta'
import { readableTextTool } from './readable-text/meta'
import { diceRollerTool } from './dice-roller/meta'
import { typingTestTool } from './typing-test/meta'
import { imageToAsciiTool } from './image-to-ascii/meta'
import { steganographyTool } from './steganography/meta'
import { photoBoothTool } from './photo-booth/meta'
import { flashcardsTool } from './flashcards/meta'
import { kanbanTool } from './kanban/meta'
import { todoTool } from './todo/meta'
import { tierListTool } from './tier-list/meta'
import { readmeGeneratorTool } from './readme-generator/meta'
import { markdownTableTool } from './markdown-table/meta'
import { fakeDataTool } from './fake-data/meta'
import { arabicVerbsTool } from './arabic-verbs/meta'
import { diacritizeTool } from './diacritize/meta'
import { removeBackgroundTool } from './remove-background/meta'
import { currencyConverterTool } from './currency-converter/meta'
import { subtitleEditorTool } from './subtitle-editor/meta'
import { arabicNumeralsTool } from './arabic-numerals/meta'
import { saudiPhoneTool } from './saudi-phone/meta'
import { arabicNormalizeTool } from './arabic-normalize/meta'
import { weatherTool } from './weather/meta'
import { idExpiryTool } from './id-expiry/meta'
import { passwordStrengthTool } from './password-strength/meta'
import { passportPhotoTool } from './passport-photo/meta'
import { audioConvertTool } from './audio-convert/meta'
import { audioSpectrumTool } from './audio-spectrum/meta'
import { pdfToWordTool } from './pdf-to-word/meta'
import { spinWheelTool } from './spin-wheel/meta'
import { cronBuilderTool } from './cron-builder/meta'
import { barcodeTool } from './barcode/meta'
import { coordinatesTool } from './coordinates/meta'
import { urlParserTool } from './url-parser/meta'
import { jsonDiffTool } from './json-diff/meta'
import { francoArabicTool } from './franco-arabic/meta'
import { teamMakerTool } from './team-maker/meta'
import { charFinderTool } from './char-finder/meta'
import { hijriAgeTool } from './hijri-age/meta'
import { certificateTool } from './certificate/meta'
import { passphraseTool } from './passphrase/meta'
import { colourBlindTool } from './colour-blind/meta'
import { batchWatermarkTool } from './batch-watermark/meta'
import { metronomeTool } from './metronome/meta'
import { bpmTapTool } from './bpm-tap/meta'
import { saudiPlateTool } from './saudi-plate/meta'
import { shortAddressTool } from './short-address/meta'
import { worksheetsTool } from './worksheets/meta'
import { quizMakerTool } from './quiz-maker/meta'
import { translateTool } from './translate/meta'
import { videoEditTool } from './video-edit/meta'
import { arabicHandwritingTool } from './arabic-handwriting/meta'
import { khatmaTool } from './khatma/meta'
import { certDecoderTool } from './cert-decoder/meta'
import { seatingChartTool } from './seating-chart/meta'
import { timetableTool } from './timetable/meta'
import { activityScheduleTool } from './activity-schedule/meta'
import { attendanceSheetTool } from './attendance-sheet/meta'
import { csvVcardTool } from './csv-vcard/meta'
import { nameSpellingTool } from './name-spelling/meta'
import { pdfOcrTool } from './pdf-ocr/meta'
import { stopwatchTool } from './stopwatch/meta'

/**
 * The tool catalog. Stable/beta tools render inside the app at /tools/:id.
 * "coming-soon" entries advertise the roadmap and are not yet routable.
 *
 * Order here is the order shown on the home catalog.
 */
export const tools: Tool[] = [
  bookWithMeTool,
  callsTool,
  messagesTool,
  excelEditorTool,
  wordEditorTool,
  powerpointEditorTool,
  removeBackgroundTool,
  passportPhotoTool,
  weatherTool,
  audioConvertTool,
  audioSpectrumTool,
  videoEditTool,
  currencyConverterTool,
  idExpiryTool,
  passwordGeneratorTool,
  passwordStrengthTool,
  subtitleEditorTool,
  saudiPhoneTool,
  arabicNumeralsTool,
  arabicNormalizeTool,
  francoArabicTool,
  promptAnalyzerTool,
  jwtDecoderTool,
  certDecoderTool,
  cronBuilderTool,
  jsonDiffTool,
  urlEncoderTool,
  urlParserTool,
  baseConverterTool,
  csvJsonTool,
  colourBlindTool,
  splitBillTool,
  metronomeTool,
  bpmTapTool,
  zakatCalculatorTool,
  hijriCalendarTool,
  // Before hijri-age: «حاسبة العمر» ties the two exactly, and a bare
  // "age calculator" means the ordinary one.
  dateDiffTool,
  hijriAgeTool,
  coordinatesTool,
  cubicBezierTool,
  readmeGeneratorTool,
  markdownTableTool,
  fakeDataTool,
  readableTextTool,
  charFinderTool,
  todoTool,
  flashcardsTool,
  kanbanTool,
  spinWheelTool,
  teamMakerTool,
  diceRollerTool,
  typingTestTool,
  tierListTool,
  imageToAsciiTool,
  seatingChartTool,
  timetableTool,
  activityScheduleTool,
  attendanceSheetTool,
  arabicHandwritingTool,
  worksheetsTool,
  quizMakerTool,
  steganographyTool,
  batchWatermarkTool,
  photoBoothTool,
  cvGeneratorTool,
  linkShortenerTool,
  qrCodeTool,
  barcodeTool,
  imageCompressorTool,
  imageEditTool,
  docScanTool,
  pdfMergeTool,
  pdfOcrTool,
  stopwatchTool,
  pdfToImagesTool,
  pdfToWordTool,
  imageToTextTool,
  qrReaderTool,
  pdfSignTool,
  pdfFillTool,
  pdfEditTool,
  pdfCompressTool,
  certificateTool,
  prayerTimesTool,
  islamicCalendarTool,
  adhkarTool,
  hajjUmrahTool,
  hisnAlMuslimTool,
  istikharaTool,
  khatmaTool,
  ibanValidatorTool,
  nameSpellingTool,
  saudiPlateTool,
  shortAddressTool,
  tafqeetTool,
  arabicVerbsTool,
  diacritizeTool,
  qiblaTool,
  passphraseTool,
  uuidGeneratorTool,
  caseConverterTool,
  poetryTool,
  translateTool,
  languageDetectTool,
  unitConverterTool,
  csvVcardTool,

]

export function getTool(id: string | undefined): Tool | undefined {
  if (!id) return undefined
  return tools.find((t) => t.id === id)
}

export const liveTools = tools.filter((t) => t.status !== 'coming-soon')
