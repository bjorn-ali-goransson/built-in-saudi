import { test, expect } from '@playwright/test'

// Search ranking, driven through the real catalogue.
//
// These are the queries that measurably failed before the ranking work: with
// 184 tools, a fuzzy matcher tuned at ~100 returned NOTHING for 14 of 68 bench
// queries, because the whole query — spaces included — had to appear in one
// field in order. "pdf merge" could not find the tool named "Merge PDFs".
//
// Measured over that bench: top-1 75% -> 94%, top-3 78% -> 100%, unfindable
// 14 -> 0. These cases are the ones worth freezing.

const top = (page: import('@playwright/test').Page) => page.locator('[data-testid^="tool-"]').first()

async function search(page: import('@playwright/test').Page, query: string, locale = 'en') {
  await page.goto(`/${locale}`)
  await page.locator('.tool-search__input').fill(query)
}

test('word order does not matter', async ({ page }) => {
  // The single biggest failure: every multi-word query whose words appear in a
  // different order than the tool's name found nothing at all.
  await search(page, 'pdf merge')
  await expect(top(page)).toContainText(/merge/i)
  await search(page, 'merge pdf')
  await expect(top(page)).toContainText(/merge/i)
})

test('a sentence with filler words still finds the tool', async ({ page }) => {
  // "is" and "my" are in no tool anywhere, and one unmatched word used to take
  // the whole query down with it.
  await search(page, 'is my password good')
  await expect(page.locator('[data-testid^="tool-"]').first()).toContainText(/password/i)
})

test('the words people use, not the words a developer wrote', async ({ page }) => {
  await search(page, 'make picture smaller')
  await expect(top(page)).toContainText(/compress/i)
})

test('matching every word beats matching one word strongly', async ({ page }) => {
  // "compress image" must not rank the PDF compressor first just because its
  // name contains "compress".
  await search(page, 'compress image')
  await expect(top(page)).toContainText(/image/i)
})

test('Arabic queries rank on the Arabic name', async ({ page }) => {
  await search(page, 'ضغط صورة', 'ar')
  await expect(top(page)).toContainText(/صور/)
  await search(page, 'مواقيت', 'ar')
  await expect(top(page)).toContainText(/الصلاة/)
})

test('an exact tool name still wins outright', async ({ page }) => {
  await search(page, 'metronome')
  await expect(top(page)).toContainText(/metronome/i)
  await search(page, 'khatma')
  await expect(top(page)).toContainText(/khatma/i)
})

test('the launcher searches the same way', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.getByTestId('app-launcher').click()
  await page.getByTestId('launcher-search').fill('excel to csv')
  // The launcher and the home catalogue share one scorer, so a query that works
  // in one has to work in the other.
  await expect(page.getByTestId('tool-xlsx-convert')).toBeVisible()
})

test('a query nothing matches still says so rather than showing everything', async ({ page }) => {
  await search(page, 'zzzzqqqq')
  await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
})

// A second round, after four file tools were added. Adding tools measurably
// DEGRADED search: on the same 81-query bench, top-1 fell to 88% because a new
// tool captured a generic query and another was unfindable by the words people
// use for it. Fixing the metadata (not the scorer) took it to 91% / 100% top-3.
// These are the cases that moved.

test('a new tool must not capture a generic term from the established one', async ({ page }) => {
  // "Scanned PDF to Text" was first called "OCR a Scanned PDF", which starts
  // with OCR and therefore outscored "Image to Text (OCR)" on a bare "ocr" —
  // a query that means the general tool, not the PDF one.
  await search(page, 'ocr')
  await expect(top(page)).toContainText(/image to text/i)
  // ...while the specific query still reaches the specific tool.
  await search(page, 'scanned pdf')
  await expect(top(page)).toContainText(/scanned pdf/i)
})

test('the tool that READS a format leads on that format', async ({ page }) => {
  // Both the reader and the writer list "xlsx"; they tied exactly, so the
  // winner was whichever was registered first.
  await search(page, 'xlsx')
  await expect(page.getByTestId('tool-xlsx-convert')).toBeVisible()
  await expect(top(page)).toContainText(/excel to csv/i)
  await search(page, 'csv to excel')
  await expect(top(page)).toContainText(/csv to excel/i)
})

test('a converter is findable by what people call the output, not the format', async ({ page }) => {
  // "contacts to spreadsheet" ranked vCard to CSV FOURTH, behind the tool that
  // converts the other way, because it never used the word "spreadsheet".
  await search(page, 'contacts to spreadsheet')
  await expect(page.getByTestId('tool-vcard-to-csv')).toBeVisible()
  // Asserted on the testid, not the display name: this tool has since been
  // RENAMED (vCard to CSV -> Contacts to Spreadsheet) precisely so the direction
  // is recoverable from the name, and a spec that pins the old name turns a
  // deliberate rename into a red build for no reason.
  await search(page, 'export phone contacts')
  await expect(page.getByTestId('tool-vcard-to-csv')).toBeVisible()
})

test('the new file tools are reachable by their plain names', async ({ page }) => {
  await search(page, 'word to text')
  await expect(top(page)).toContainText(/word to text/i)
  await search(page, 'docx')
  await expect(top(page)).toContainText(/word to text/i)
  await search(page, 'vcf to csv')
  await expect(page.getByTestId('tool-vcard-to-csv')).toBeVisible()
})

// The catalogue's SHAPE, not its ranking. Measured at 191 tools: "Converters"
// held three tools while the turn-this-file-into-that family was scattered
// across Text, Files and Converters — so the section named for the intent was
// the one place you would not find it. Two of its three were VALUE converters
// (units, currency), which is a different job entirely.

test('the section named for converting holds the file converters', async ({ page }) => {
  await page.goto('/en')
  const converters = page.getByTestId('section-Converters')
  await expect(converters).toBeVisible()
  for (const id of ['docx-to-text', 'pptx-to-text', 'csv-to-xlsx', 'xlsx-convert', 'vcard-to-csv', 'epub-text']) {
    await expect(converters.getByTestId(`tool-${id}`)).toBeVisible()
  }
})

test('converting a value is a calculator, not a file converter', async ({ page }) => {
  await page.goto('/en')
  // Unit and currency conversion sit with percentage/VAT/zakat, where someone
  // doing arithmetic is already looking.
  await expect(page.getByTestId('section-Calculators').getByTestId('tool-unit-converter')).toBeVisible()
  await expect(page.getByTestId('section-Converters').getByTestId('tool-unit-converter')).toHaveCount(0)
})

test('a tool with a stronger family keeps it', async ({ page }) => {
  await page.goto('/en')
  // Nobody hunts for the PDF converter anywhere but PDF, so pdf-to-text stays
  // put even though it converts a file.
  await expect(page.getByTestId('section-PDF').getByTestId('tool-pdf-to-text')).toBeVisible()
})

test('the tools about a website live under Web, not buried in Developer', async ({ page }) => {
  // Developer was 32 tools — the biggest section by a distance and an
  // undifferentiated wall. Only the uncontested part was split off: things you
  // point at a site or a URL, rather than at code.
  await page.goto('/en')
  const web = page.getByTestId('section-Web')
  await expect(web).toBeVisible()
  for (const id of ['meta-tags', 'robots-txt', 'link-preview', 'url-parser', 'user-agent']) {
    await expect(web.getByTestId(`tool-${id}`)).toBeVisible()
  }
  // A subnet calculator is a networking tool a developer reaches for, not
  // something you use on a site — it deliberately stayed put.
  await expect(page.getByTestId('section-Developer').getByTestId('tool-ip-subnet')).toBeVisible()
})

test('the new category has an Arabic label, not a raw English fallback', async ({ page }) => {
  await page.goto('/ar')
  await expect(page.getByTestId('section-Web')).toContainText('الويب')
})

// Arabic morphology defeats substring matching, and it cost two tools their own
// query. A name in the plural or as an agent noun does not contain the singular
// or verbal noun a person types, so the SPECIFIC tool won by accident: the QR
// reader is "قارئ رمز الفاتورة" and beat the invoice generator on "فاتورة"; the
// subtitle editor is "محرّر الترجمة" and beat the translator on "ترجمة".

test('an Arabic query finds the tool that does the thing, not the one that mentions it', async ({ page }) => {
  await search(page, 'فاتورة', 'ar')
  await expect(top(page)).toContainText('فاتورة')
  await expect(page.getByTestId('tool-invoice-generator')).toBeVisible()

  await search(page, 'ترجمة', 'ar')
  await expect(page.getByTestId('tool-translate')).toBeVisible()
  await expect(top(page)).toContainText('ترجمة')
})

test('the newest Saudi tools are reachable by what people call them', async ({ page }) => {
  for (const [q, id] of [['gosi', 'gosi-salary'], ['fahes', 'vehicle-renewal'],
    ['rent increase', 'rent-rules'], ['vat registration', 'vat-registration']] as const) {
    await search(page, q)
    await expect(page.getByTestId(`tool-${id}`)).toBeVisible()
  }
})

test('and by their Arabic names', async ({ page }) => {
  for (const [q, id] of [['التأمينات', 'gosi-salary'], ['الفحص الدوري', 'vehicle-renewal'],
    ['زيادة الإيجار', 'rent-rules']] as const) {
    await search(page, q, 'ar')
    await expect(page.getByTestId(`tool-${id}`)).toBeVisible()
  }
})

// Found by measuring queries the bench had never seen: when stop-word removal
// left ONE term, the scorer threw the filtering away and matched the whole
// query, stop words included. So a bare "qr" ranked the generator first while
// "make a qr" found nothing at all.

test('a query that is one real word plus filler still finds the tool', async ({ page }) => {
  await search(page, 'make a qr')
  await expect(page.getByTestId('tool-qr-code')).toBeVisible()

  await search(page, 'my iqama')
  await expect(page.getByTestId('tool-id-expiry')).toBeVisible()
})

test('the filler words do not dilute the ranking either', async ({ page }) => {
  // Not merely findable — FIRST. The one real word has to carry the query, or
  // the fix would just be trading one kind of wrong answer for another.
  await search(page, 'make a qr')
  await expect(top(page)).toContainText(/qr/i)
  await search(page, 'qr')
  await expect(top(page)).toContainText(/qr/i)
})

// A second set of untuned queries, sharing no members with the first, found
// two more Arabic defects. Both fail in the direction nobody checks: the QUERY
// is longer than the indexed text, so neither substring nor subsequence can
// bridge it.

test('the Arabic definite article does not hide the tool', async ({ page }) => {
  // A person types الزكاة; the keyword is زكاة. Before stripping ال- this
  // returned the VAT registration tool.
  await search(page, 'كيف احسب الزكاة', 'ar')
  await expect(page.getByTestId('tool-zakat-calculator')).toBeVisible()
})

test('a question word is filler, in either language', async ({ page }) => {
  // "how" was a stop word from the start and the other interrogatives were not.
  await search(page, 'when is ramadan')
  await expect(page.locator('[data-testid^="tool-"]').first()).toBeVisible()
  await search(page, 'ما هو الايبان', 'ar')
  await expect(page.getByTestId('tool-iban-validator')).toBeVisible()
})

test('a bare فاتورة means the invoice tool, not the electricity bill', async ({ page }) => {
  // They tie exactly, so this is decided by catalogue order — which is an
  // editorial judgement, and the judgement is that an invoice is the invoice.
  await search(page, 'فاتورة', 'ar')
  await expect(top(page)).toContainText('فاتورة')
  await expect(page.getByTestId('tool-invoice-generator')).toBeVisible()
})

// --- A held-out set of 50 queries, written from the tool list and never tuned
// against, scored 88% top-1 where the tuned bench read 100%. Everything below
// is one of the defects it found. See evals/untuned.mjs.

test('a shipped capability is findable by its name', async ({ page }) => {
  // The site decodes HEIC everywhere an image is taken (#226) and NOT ONE tool
  // indexed the word, so the query an iPhone owner on Android actually types
  // returned no tool at all. A capability nobody can name is not shipped.
  await search(page, 'heic')
  await expect(page.getByTestId('tool-image-format-converter')).toBeVisible()
})

test('a substring inside another word is not a match', async ({ page }) => {
  // "old" is inside "Golden Hour", so the sunrise tool beat the age calculator.
  // The mid-word penalty is Latin-only on purpose: Arabic agglutinates, so a
  // mid-word hit there is what a real match looks like.
  await search(page, 'how old am i')
  await expect(page.getByTestId('tool-age-calculator')).toBeVisible()
  await expect(top(page)).toContainText(/age/i)
  // The Arabic side of that decision: the article is attached to the noun.
  await search(page, 'حاسبة النسبة', 'ar')
  await expect(page.getByTestId('tool-percentage-calculator')).toBeVisible()
})

test('a converter is findable in the direction it converts', async ({ page }) => {
  // Word order is discarded on purpose, so "contacts to spreadsheet" and
  // "spreadsheet to contacts" are the same query to the scorer — and the tool
  // that goes the WRONG way was winning, because its name held both concepts
  // while its inverse was named in file formats. Both now index the phrase.
  await search(page, 'contacts to spreadsheet')
  await expect(page.getByTestId('tool-vcard-to-csv')).toBeVisible()
  await search(page, 'spreadsheet to contacts')
  await expect(page.getByTestId('tool-csv-vcard')).toBeVisible()
})

test('a bare noun goes to the tool that makes the thing', async ({ page }) => {
  // These tie EXACTLY, so they are decided by catalogue order. The editorial
  // rule, consistent with qr -> generator: for a bare noun, the tool that makes
  // the thing is primary.
  await search(page, 'password')
  await expect(top(page)).toContainText(/generator/i)
  await search(page, 'hijri')
  await expect(top(page)).toContainText(/calendar/i)
  await search(page, 'cron')
  await expect(top(page)).toContainText(/builder/i)
})

test('asking whether a password is any good finds the checker', async ({ page }) => {
  // The evaluative words were missing from the checker entirely — nobody types
  // "entropy" — so the generator won on a scattered subsequence of "good".
  await search(page, 'is my password good')
  await expect(page.getByTestId('tool-password-strength')).toBeVisible()
  // ...without stealing the generator's own query.
  await search(page, 'strong password')
  await expect(top(page)).toContainText(/generator/i)
})

test('a keyword must describe what the tool does, not what it tolerates', async ({ page }) => {
  // Organise PDF Pages listed "مسح ضوئي" because it PRESERVES a scan, and so
  // took the query from the tool that reads one.
  await search(page, 'مسح ضوئي', 'ar')
  await expect(page.getByTestId('tool-pdf-ocr')).toBeVisible()
})

// --- A relevance floor. Neither the home catalogue nor the launcher capped the
// result list, so at 202 tools a query rendered every tool that matched at all —
// 31 cards on average, three of them worth looking at.

test('a query does not render a card for every tool that matched at all', async ({ page }) => {
  await search(page, 'pdf merge')
  const cards = page.locator('[data-testid^="tool-"]')
  // The right answer is still first; the tail is gone.
  await expect(cards.first()).toContainText(/merge/i)
  const n = await cards.count()
  // Measured: 35 tools score above zero for this, 16 survive the floor — and
  // those sixteen are all real PDF tools, so the bound is set from what was
  // measured rather than from a round number that felt tidy. The point is that
  // the long tail of one-character subsequence hits is gone, not that the PDF
  // family is trimmed.
  expect(n).toBeGreaterThan(0)
  expect(n).toBeLessThan(25)
})

test('a broad query keeps its whole family, because the floor is relative', async ({ page }) => {
  // The reason the floor is a share of the top hit rather than a fixed score:
  // a broad query legitimately has many good answers, and they all score alike.
  await search(page, 'pdf')
  await expect(page.locator('[data-testid^="tool-"]')).not.toHaveCount(0)
  const n = await page.locator('[data-testid^="tool-"]').count()
  expect(n).toBeGreaterThan(8)
})

test('a query we cannot serve at all returns nothing rather than a guess', async ({ page }) => {
  // Measured: the top hit for these sits far below the worst genuinely correct
  // answer (128), so the absolute floor catches them and nothing legitimate.
  for (const q of ['buy bitcoin', 'asdfghjkl', 'قهوة']) {
    await search(page, q)
    await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
  }
})

// --- The catalogue's SHAPE, measured by evals/catalogshape.mjs. Saudi / Local
// had reached 31 tools, 1.6x the median section, largely from this session's
// own additions. Three unrelated families were mashed together in it.

test('Islamic and Arabic tools are not filed under a country', async ({ page }) => {
  // A Muslim in Malaysia wants the Hijri calendar; an Egyptian writer wants the
  // diacritizer. Filing either under "Saudi / Local" was a categorisation error
  // as much as a discoverability one.
  await page.goto('/en')
  await expect(page.getByTestId('section-Islamic')).toBeVisible()
  await expect(page.getByTestId('section-Islamic')).toContainText('Islamic')
  await expect(page.getByTestId('section-Arabic')).toBeVisible()
  const islamic = page.getByTestId('section-Islamic')
  await expect(islamic.getByTestId('tool-hijri-calendar')).toBeVisible()
  const arabic = page.getByTestId('section-Arabic')
  await expect(arabic.getByTestId('tool-diacritize')).toBeVisible()
  // And they have left the section they came from.
  await expect(page.getByTestId('section-Saudi / Local').getByTestId('tool-hijri-calendar')).toHaveCount(0)
})

test('the new sections are labelled in Arabic too', async ({ page }) => {
  // A category with no entry in CATEGORY_LABELS renders its raw English string
  // on the Arabic side — a silent bug the map's own comment warns about.
  await page.goto('/ar')
  await expect(page.getByTestId('section-Islamic')).toContainText('إسلاميات')
  await expect(page.getByTestId('section-Arabic')).toContainText('العربية')
})

test('a description is not indexed, and the compress query proves why', async ({ page }) => {
  // Indexing the long `description` was tried and rejected on measurement: it
  // left both held-out sets unchanged (the second at exactly 45/50 with exactly
  // the same misses) and cost this query, because the PDF compressor's
  // description is full of compression vocabulary. Frozen here so the idea
  // cannot be re-added on the strength of it sounding reasonable.
  await search(page, 'ضغط صورة', 'ar')
  await expect(page.getByTestId('tool-image-compressor')).toBeVisible()
  await expect(top(page)).toContainText(/صور/)
})

test('British and American spellings both find the tool', async ({ page }) => {
  // Measured: 8 of 12 -ise/-ize variants missed their tool and 5 returned
  // NOTHING AT ALL — the site writes British English in its own copy while a
  // keyword list, written by a developer, tends to the American form. Both are
  // typed by real people.
  await search(page, 'anonymise')
  await expect(page.getByTestId('tool-data-anonymize')).toBeVisible()
  await search(page, 'normalise')
  await expect(page.getByTestId('tool-arabic-normalize')).toBeVisible()
  await search(page, 'optimizer for svg')
  await expect(page.getByTestId('tool-svg-optimise')).toBeVisible()
})

// --- A dedicated ARABIC held-out set (evals/untunedar.mjs). The three existing
// sets were 10–16% Arabic on a site whose audience is half Arabic-speaking, and
// the two worst search defects ever found here were both Arabic morphology.
// First run: 90% top-1, the same as the English set — but it found two real
// defects that thin coverage had hidden.

test('an Arabic name must be in the form people type, not the plural', async ({ page }) => {
  // The password generator was «مولّد كلمات المرور». The PLURAL «كلمات» does not
  // contain the singular «كلمة» somebody types, so the name could never match
  // and the query went to the strength checker. Same trap as فاتورة and ترجمة.
  await search(page, 'كلمة مرور قوية', 'ar')
  await expect(page.getByTestId('tool-password-generator')).toBeVisible()
  await expect(top(page)).toContainText(/مولّد/)
})

test('the redactor is findable by the Arabic word for redaction', async ({ page }) => {
  // «طمس» was missing from its keywords entirely: it scored 41.67, BELOW the
  // relevance floor, so the tool did not appear at all for its own subject.
  await search(page, 'طمس وجه في صورة', 'ar')
  await expect(page.getByTestId('tool-image-redact')).toBeVisible()
})

// --- A new tool taking an established tool's query. Fourth occurrence, so it
// is frozen here rather than only in the bench. `node evals/ownname.mjs` is the
// general form: every tool must still win a search for its own name (425/426
// today, the one exception being the documented باركود / QR ambiguity).

test('the rule tool keeps "overtime pay", not the calculator that also computes it', async ({ page }) => {
  // `timesheet` shipped with 'payroll' in its keywords and took this query off
  // `leave-overtime`, which is the tool that owns the 150% rule and the 720-hour
  // cap. The established tool gets the exact phrase.
  await search(page, 'overtime pay')
  await expect(top(page)).toContainText(/Leave/i)
})

test('and the calculator still owns the queries that are about it', async ({ page }) => {
  // Without this the fix above could be a keyword shoved somewhere that simply
  // outranks the newer tool everywhere, which would be a worse trade.
  await search(page, 'time card')
  await expect(page.getByTestId('tool-timesheet')).toBeVisible()
  await expect(top(page)).toContainText(/Time Card/i)
})

test('a converter and its inverse each win their own direction', async ({ page }) => {
  // Three tools now share this vocabulary — Word to Text, Word to Markdown and
  // Markdown to Word — which is exactly where a new tool blurs an old one.
  await search(page, 'word to markdown')
  await expect(top(page)).toContainText(/Word to Markdown/i)
  await search(page, 'markdown to word')
  await expect(top(page)).toContainText(/Markdown to Word/i)
  await search(page, 'word to text')
  await expect(top(page)).toContainText(/Word to Text/i)
})

// --- Typos. Measured before this existed (`node evals/typoprobe.mjs`, 23
// realistic mistypings of queries the benches already agree on): 74% still
// found the right tool first and 2 returned NOTHING AT ALL. After: 78%, and 0
// empty. The correction is a FALLBACK — it only runs when what was typed found
// nothing — which is why all four benches are unchanged by construction.

test('a one-letter slip finds the tool instead of an empty page', async ({ page }) => {
  await search(page, 'tiemsheet')
  await expect(page.getByTestId('tool-timesheet')).toBeVisible()
  await expect(page.getByTestId('search-corrected')).toContainText('timesheet')
})

test('a correctly spelled query is never second-guessed', async ({ page }) => {
  // Correcting a word somebody spelled right is how a search box starts
  // arguing with people, and it would also mean the fallback was not a fallback.
  await search(page, 'timesheet')
  await expect(page.getByTestId('tool-timesheet')).toBeVisible()
  await expect(page.getByTestId('search-corrected')).toHaveCount(0)
})

test('gibberish still returns nothing rather than a nearest guess', async ({ page }) => {
  // The correction is only shown when it FOUND something. "Showing results for
  // <something else>" above an empty page is worse than the empty page.
  await search(page, 'zzzzqqqq')
  await expect(page.getByTestId('search-corrected')).toHaveCount(0)
  await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
})

test('a short word is not "corrected" into a tool we happen to have', async ({ page }) => {
  // Measured: at a four-character threshold the Arabic «قهوة» (coffee) — a query
  // this site genuinely cannot serve — is one deletion from «قوة» (strength) and
  // was answered with the password strength checker. Arabic words are short and
  // dense, so one edit reaches a great many of them. Five characters removes
  // that and costs no true correction.
  await search(page, 'قهوة', 'ar')
  await expect(page.getByTestId('search-corrected')).toHaveCount(0)
  await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
})

test('the launcher corrects a typo the same way', async ({ page }) => {
  // The two surfaces share one ranker precisely so they cannot drift.
  await page.goto('/en/apps/qr-code')
  await page.getByTestId('app-launcher').click()
  await page.getByTestId('launcher-search').fill('tiemsheet')
  await expect(page.getByTestId('tool-timesheet')).toBeVisible()
  await expect(page.getByTestId('search-corrected')).toBeVisible()
})
