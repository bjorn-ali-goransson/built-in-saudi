import type { Tool } from './types'
import { imageCompressorTool } from './image-compressor/meta'
import { imageFormatConverterTool } from './image-format-converter/meta'
import { imageCropperTool } from './image-cropper/meta'
import { imageRearrangeTool } from './image-rearrange/meta'
import { imagesToPdfTool } from './images-to-pdf/meta'
import { pdfMergeTool } from './pdf-merge/meta'
import { pdfSplitTool } from './pdf-split/meta'
import { pdfToImagesTool } from './pdf-to-images/meta'
import { imageToTextTool } from './image-to-text/meta'
import { qrReaderTool } from './qr-reader/meta'
import { metadataRemoveTool } from './metadata-remove/meta'
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
import { hajjUmrahTool } from './hajj-umrah/meta'
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
import { a11yCheckTool } from './a11y-check/meta'
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
import { flashcardsTool } from './flashcards/meta'
import { kanbanTool } from './kanban/meta'
import { todoTool } from './todo/meta'
import { tierListTool } from './tier-list/meta'
import { readmeGeneratorTool } from './readme-generator/meta'
import { markdownTableTool } from './markdown-table/meta'
import { svgEditorTool } from './svg-editor/meta'
import { fakeDataTool } from './fake-data/meta'
import { slugifyTool } from './slugify/meta'
import { lineBreaksTool } from './line-breaks/meta'
import { pasteToMarkdownTool } from './paste-to-markdown/meta'
import { arabicVerbsTool } from './arabic-verbs/meta'
import { diacritizeTool } from './diacritize/meta'
import { removeBackgroundTool } from './remove-background/meta'
import { currencyConverterTool } from './currency-converter/meta'
import { subtitleEditorTool } from './subtitle-editor/meta'
import { arabicNumeralsTool } from './arabic-numerals/meta'
import { saudiPhoneTool } from './saudi-phone/meta'
import { arabicNormalizeTool } from './arabic-normalize/meta'
import { fixEncodingTool } from './fix-encoding/meta'
import { weatherTool } from './weather/meta'
import { idExpiryTool } from './id-expiry/meta'
import { totpTool } from './totp/meta'
import { passwordStrengthTool } from './password-strength/meta'
import { passportPhotoTool } from './passport-photo/meta'
import { audioTrimTool } from './audio-trim/meta'
import { videoAudioTool } from './video-audio/meta'
import { audioConvertTool } from './audio-convert/meta'
import { pdfToTextTool } from './pdf-to-text/meta'
import { screenshotFrameTool } from './screenshot-frame/meta'
import { socialResizeTool } from './social-resize/meta'
import { spinWheelTool } from './spin-wheel/meta'
import { hmacTool } from './hmac/meta'
import { cronBuilderTool } from './cron-builder/meta'
import { csvCleanTool } from './csv-clean/meta'
import { dataAnonymizeTool } from './data-anonymize/meta'
import { invisibleCharsTool } from './invisible-chars/meta'
import { timezonePlannerTool } from './timezone-planner/meta'
import { calorieNeedsTool } from './calorie-needs/meta'
import { barcodeTool } from './barcode/meta'
import { curlConvertTool } from './curl-convert/meta'
import { coordinatesTool } from './coordinates/meta'
import { urlParserTool } from './url-parser/meta'
import { linkPreviewTool } from './link-preview/meta'
import { paperGeneratorTool } from './paper-generator/meta'
import { colorPaletteTool } from './color-palette/meta'
import { jsonDiffTool } from './json-diff/meta'
import { hexViewerTool } from './hex-viewer/meta'
import { sunTimesTool } from './sun-times/meta'
import { francoArabicTool } from './franco-arabic/meta'
import { teamMakerTool } from './team-maker/meta'
import { quotationTool } from './quotation/meta'
import { charFinderTool } from './char-finder/meta'
import { glucoseUnitsTool } from './glucose-units/meta'
import { sleepCycleTool } from './sleep-cycle/meta'
import { waterIntakeTool } from './water-intake/meta'
import { dueDateTool } from './due-date/meta'
import { hijriAgeTool } from './hijri-age/meta'
import { medicineScheduleTool } from './medicine-schedule/meta'
import { pdfRedactTool } from './pdf-redact/meta'
import { videoGifTool } from './video-gif/meta'
import { videoFramesTool } from './video-frames/meta'
import { carouselSplitTool } from './carousel-split/meta'
import { csvMergeTool } from './csv-merge/meta'
import { pdfBookletTool } from './pdf-booklet/meta'
import { pdfStampTool } from './pdf-stamp/meta'
import { labelSheetTool } from './label-sheet/meta'
import { certificateTool } from './certificate/meta'
import { passphraseTool } from './passphrase/meta'
import { colourBlindTool } from './colour-blind/meta'
import { svgOptimiseTool } from './svg-optimise/meta'
import { batchWatermarkTool } from './batch-watermark/meta'
import { metronomeTool } from './metronome/meta'
import { tunerTool } from './tuner/meta'
import { bpmTapTool } from './bpm-tap/meta'
import { soundMeterTool } from './sound-meter/meta'
import { saudiPlateTool } from './saudi-plate/meta'
import { shortAddressTool } from './short-address/meta'
import { worksheetsTool } from './worksheets/meta'
import { bingoCardsTool } from './bingo-cards/meta'
import { wordSearchTool } from './word-search/meta'
import { quizMakerTool } from './quiz-maker/meta'
import { translateTool } from './translate/meta'
import { summarizeTool } from './summarize/meta'
import { videoTrimTool } from './video-trim/meta'
import { arabicHandwritingTool } from './arabic-handwriting/meta'
import { xlsxConvertTool } from './xlsx-convert/meta'
import { khatmaTool } from './khatma/meta'
import { icsBuilderTool } from './ics-builder/meta'
import { certDecoderTool } from './cert-decoder/meta'
import { emailHeadersTool } from './email-headers/meta'
import { seatingChartTool } from './seating-chart/meta'
import { attendanceSheetTool } from './attendance-sheet/meta'
import { csvVcardTool } from './csv-vcard/meta'
import { sheetDiffTool } from './sheet-diff/meta'
import { imageDiffTool } from './image-diff/meta'
import { prayerTimetableTool } from './prayer-timetable/meta'
import { removeSilenceTool } from './remove-silence/meta'
import { epubTextTool } from './epub-text/meta'
import { csvSplitTool } from './csv-split/meta'
import { nameSpellingTool } from './name-spelling/meta'
import { zatcaQrTool } from './zatca-qr/meta'
import { pdfOrganiseTool } from './pdf-organise/meta'
import { pdfOcrTool } from './pdf-ocr/meta'
import { docxToTextTool } from './docx-to-text/meta'
import { markdownDocxTool } from './markdown-docx/meta'
import { docxMarkdownTool } from './docx-markdown/meta'
import { markdownEpubTool } from './markdown-epub/meta'
import { csvToXlsxTool } from './csv-to-xlsx/meta'
import { vcardToCsvTool } from './vcard-to-csv/meta'
import { pptxToTextTool } from './pptx-to-text/meta'
import { gosiSalaryTool } from './gosi-salary/meta'
import { vatRegistrationTool } from './vat-registration/meta'
import { zatcaWaveTool } from './zatca-wave/meta'
import { vehicleRenewalTool } from './vehicle-renewal/meta'
import { fuelCostTool } from './fuel-cost/meta'
import { rentRulesTool } from './rent-rules/meta'
import { earlySettlementTool } from './early-settlement/meta'
import { leaveOvertimeTool } from './leave-overtime/meta'
import { timesheetTool } from './timesheet/meta'
import { exitReentryTool } from './exit-reentry/meta'
import { iqamaFeesTool } from './iqama-fees/meta'
import { electricityBillTool } from './electricity-bill/meta'
import { stopwatchTool } from './stopwatch/meta'
import { admissionScoreTool } from './admission-score/meta'
import { gpaCalculatorTool } from './gpa-calculator/meta'

/**
 * The tool catalog. Stable/beta tools render inside the app at /tools/:id.
 * "coming-soon" entries advertise the roadmap and are not yet routable.
 *
 * Order here is the order shown on the home catalog.
 */
export const tools: Tool[] = [
  bookWithMeTool,
  callsTool,
  removeBackgroundTool,
  passportPhotoTool,
  screenshotFrameTool,
  socialResizeTool,
  carouselSplitTool,
  weatherTool,
  audioTrimTool,
  removeSilenceTool,
  videoAudioTool,
  audioConvertTool,
  videoTrimTool,
  videoGifTool,
  videoFramesTool,
  currencyConverterTool,
  idExpiryTool,
  totpTool,
  passwordGeneratorTool,
  passwordStrengthTool,
  subtitleEditorTool,
  saudiPhoneTool,
  arabicNumeralsTool,
  arabicNormalizeTool,
  francoArabicTool,
  fixEncodingTool,
  promptAnalyzerTool,
  regexTesterTool,
  jwtDecoderTool,
  certDecoderTool,
  emailHeadersTool,
  cronBuilderTool,
  cronExplainerTool,
  textDiffTool,
  jsonDiffTool,
  unixTimestampTool,
  urlEncoderTool,
  urlParserTool,
  curlConvertTool,
  baseConverterTool,
  csvJsonTool,
  csvCleanTool,
  csvSplitTool,
  csvMergeTool,
  listToolsTool,
  colorContrastTool,
  a11yCheckTool,
  colourBlindTool,
  percentageCalculatorTool,
  splitBillTool,
  aspectRatioTool,
  pomodoroTool,
  metronomeTool,
  tunerTool,
  bpmTapTool,
  soundMeterTool,
  endOfServiceTool,
  zakatCalculatorTool,
  ageCalculatorTool,
  hijriCalendarTool,
  hijriAgeTool,
  workingDaysTool,
  timezonePlannerTool,
  coordinatesTool,
  sunTimesTool,
  calorieNeedsTool,
  glucoseUnitsTool,
  waterIntakeTool,
  dueDateTool,
  sleepCycleTool,
  medicineScheduleTool,
  cubicBezierTool,
  boxShadowTool,
  gradientGeneratorTool,
  ipSubnetTool,
  userAgentTool,
  metaTagsTool,
  linkPreviewTool,
  robotsTxtTool,
  gitignoreTool,
  jsonToTypesTool,
  readmeGeneratorTool,
  markdownTableTool,
  svgEditorTool,
  svgOptimiseTool,
  fakeDataTool,
  readabilityTool,
  dataAnonymizeTool,
  invisibleCharsTool,
  charFinderTool,
  slugifyTool,
  todoTool,
  flashcardsTool,
  kanbanTool,
  spinWheelTool,
  teamMakerTool,
  randomPickerTool,
  diceRollerTool,
  countdownTool,
  typingTestTool,
  tierListTool,
  imageToAsciiTool,
  memeGeneratorTool,
  faviconGeneratorTool,
  paperGeneratorTool,
  labelSheetTool,
  seatingChartTool,
  attendanceSheetTool,
  arabicHandwritingTool,
  worksheetsTool,
  bingoCardsTool,
  wordSearchTool,
  quizMakerTool,
  steganographyTool,
  imageRedactTool,
  batchWatermarkTool,
  photoBoothTool,
  screenRecorderTool,
  fileEncryptTool,
  cvGeneratorTool,
  linkShortenerTool,
  icsBuilderTool,
  qrCodeTool,
  barcodeTool,
  imageCompressorTool,
  imageFormatConverterTool,
  imageCropperTool,
  imageRearrangeTool,
  imagesToPdfTool,
  pdfMergeTool,
  pdfSplitTool,
  pdfOrganiseTool,
  pdfOcrTool,
  docxToTextTool,
  markdownDocxTool,
  docxMarkdownTool,
  markdownEpubTool,
  csvToXlsxTool,
  vcardToCsvTool,
  pptxToTextTool,
  gosiSalaryTool,
  vatRegistrationTool,
  zatcaWaveTool,
  vehicleRenewalTool,
  fuelCostTool,
  rentRulesTool,
  earlySettlementTool,
  leaveOvertimeTool,
  timesheetTool,
  exitReentryTool,
  iqamaFeesTool,
  stopwatchTool,
  admissionScoreTool,
  gpaCalculatorTool,
  pdfToImagesTool,
  pdfToTextTool,
  imageToTextTool,
  qrReaderTool,
  metadataRemoveTool,
  pdfSignTool,
  pdfFillTool,
  pdfEditTool,
  pdfCompressTool,
  pdfRedactTool,
  pdfBookletTool,
  pdfStampTool,
  invoiceGeneratorTool,
  electricityBillTool,
  quotationTool,
  certificateTool,
  prayerTimesTool,
  islamicCalendarTool,
  adhkarTool,
  hajjUmrahTool,
  hisnAlMuslimTool,
  istikharaTool,
  prayerTimetableTool,
  khatmaTool,
  zatcaQrTool,
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
  wordCounterTool,
  caseConverterTool,
  lineBreaksTool,
  pasteToMarkdownTool,
  poetryTool,
  translateTool,
  summarizeTool,
  languageDetectTool,
  hashGeneratorTool,
  hmacTool,
  loremTool,
  jsonFormatterTool,
  unitConverterTool,
  base64Tool,
  vatCalculatorTool,
  dateDiffTool,
  xlsxConvertTool,
  csvVcardTool,
  sheetDiffTool,
  imageDiffTool,
  epubTextTool,
  zipInspectorTool,
  hexViewerTool,
  metadataTool,
  colorPaletteTool,
  colorToolsTool,

]

export function getTool(id: string | undefined): Tool | undefined {
  if (!id) return undefined
  return tools.find((t) => t.id === id)
}

export const liveTools = tools.filter((t) => t.status !== 'coming-soon')
export const comingSoonTools = tools.filter((t) => t.status === 'coming-soon')
