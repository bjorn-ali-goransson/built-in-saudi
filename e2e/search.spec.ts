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
  // "PDF to Text" was first called "OCR a Scanned PDF", which starts
  // with OCR and therefore outscored "Image to Text (OCR)" on a bare "ocr" —
  // a query that means the general tool, not the PDF one. Since November 2026
  // the two are one tool, so "ocr" must land on it, in its picture half too.
  await search(page, 'ocr')
  await expect(top(page)).toHaveAttribute('data-testid', 'tool-pdf-ocr')
  await search(page, 'text from image')
  await expect(top(page)).toHaveAttribute('data-testid', 'tool-pdf-ocr')
  // ...while the specific query still reaches the specific tool.
  await search(page, 'scanned pdf')
  await expect(top(page)).toContainText(/PDF to Text/i)
})

// The catalogue's SHAPE, not its ranking. Measured at 191 tools: "Converters"
// held three tools while the turn-this-file-into-that family was scattered
// across Text, Files and Converters — so the section named for the intent was
// the one place you would not find it. Two of its three were VALUE converters
// (units, currency), which is a different job entirely.

// Filing is about which section a tool is IN, not whether it is above the
// fold of it: a tool the analytics demote waits behind its section's "more".
async function expandSection(page: import('@playwright/test').Page, key: string) {
  const more = page.getByTestId(`section-more-${key}`)
  if (await more.count()) await more.click()
}

test('a tool with a stronger family keeps it', async ({ page }) => {
  await page.goto('/en')
  // Nobody hunts for the PDF converter anywhere but PDF, so PDF to Text stays
  // put even though it converts a file.
  await expect(page.getByTestId('section-PDF').getByTestId('tool-pdf-ocr')).toBeVisible()
})

// Arabic morphology defeats substring matching, and it cost two tools their own
// query. A name in the plural or as an agent noun does not contain the singular
// or verbal noun a person types, so the SPECIFIC tool won by accident: the QR
// reader is "قارئ رمز الفاتورة" and beat the invoice generator on "فاتورة"; the
// subtitle editor is "محرّر الترجمة" and beat the translator on "ترجمة".

test('an Arabic query finds the tool that does the thing, not the one that mentions it', async ({ page }) => {
  await search(page, 'ترجمة', 'ar')
  await expect(page.getByTestId('tool-translate')).toBeVisible()
  await expect(top(page)).toContainText('ترجمة')
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
  // Every member of the family, not a count: the family shrank from 16 to 6 in
  // the November 2026 merges, and a count would have had to shrink with it.
  for (const id of ['pdf-merge', 'pdf-edit', 'pdf-compress', 'pdf-to-word', 'pdf-to-images', 'pdf-ocr']) {
    await expect(page.getByTestId(`tool-${id}`), id).toBeVisible()
  }
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

// --- A new tool taking an established tool's query. Fourth occurrence, so it
// is frozen here rather than only in the bench. `node evals/ownname.mjs` is the
// general form: every tool must still win a search for its own name (425/426
// today, the one exception being the documented باركود / QR ambiguity).

// --- Typos. Measured before this existed (`node evals/typoprobe.mjs`, 23
// realistic mistypings of queries the benches already agree on): 74% still
// found the right tool first and 2 returned NOTHING AT ALL. After: 78%, and 0
// empty. The correction is a FALLBACK — it only runs when what was typed found
// nothing — which is why all four benches are unchanged by construction.

test('a one-letter slip finds the tool instead of an empty page', async ({ page }) => {
  await search(page, 'stopwacth')
  await expect(page.getByTestId('tool-stopwatch')).toBeVisible()
  await expect(page.getByTestId('search-corrected')).toContainText('stopwatch')
})

test('a correctly spelled query is never second-guessed', async ({ page }) => {
  // Correcting a word somebody spelled right is how a search box starts
  // arguing with people, and it would also mean the fallback was not a fallback.
  await search(page, 'stopwatch')
  await expect(page.getByTestId('tool-stopwatch')).toBeVisible()
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
  await page.getByTestId('launcher-search').fill('stopwacth')
  await expect(page.getByTestId('tool-stopwatch')).toBeVisible()
  await expect(page.getByTestId('search-corrected')).toBeVisible()
})

// --- The correction now also wins when the typed query found something WRONG,
// but only when it scores decisively better (1.5x). Measured: mistyped top-1
// 78% -> 87%, benches unchanged, and across 287 benched queries exactly one
// correction fires — onto the same tool, where it is made inert.

test('a typo that found the wrong tool is corrected, not just an empty one', async ({ page }) => {
  // "pdf mrege" used to rank pdf-merge SEVENTH behind pdf-edit, because the
  // query did return something and the fallback therefore never ran. (Merge
  // PDF now finds itself even misspelt; "pdf comprses" is the same shape.)
  await search(page, 'pdf comprses')
  await expect(top(page)).toContainText(/Compress/i)
  await expect(page.getByTestId('search-corrected')).toContainText('pdf compress')
})

test('two edits is a different word, not a typo', async ({ page }) => {
  // «توحيد الهمزات» (unifying hamzas) is two edits from «توحيد العملات»
  // (unifying currencies), and at a two-edit limit the Arabic normaliser's own
  // query went to the currency converter. Every genuine typo measured is one
  // edit; this is the case that set the limit.
  await search(page, 'توحيد الهمزات', 'ar')
  await expect(page.getByTestId('tool-arabic-normalize')).toBeVisible()
  await expect(page.getByTestId('search-corrected')).toHaveCount(0)
})

// --- held-out set #3, 10 August 2026 -----------------------------------------
//
// A third fresh set was written because the first two were spent: #1 was BURNED
// by fixing what it found, and #2 has been run as a regression check on every
// pass since. Neither could answer whether the category offer, the collections,
// the Health / Time & Date split and six new tools helped a query nobody had
// seen.
//
// First reading: **73% top-1, 86% top-3, 0 unfindable** over 51 conversational
// queries — well below the 88–90% the earlier sets first read, because this one
// is deliberately weighted towards natural sentences rather than tool-name-ish
// phrasings. Fixing what it found took it to **86% / 96%**, and the cases below
// freeze those fixes. Every one was a documented failure class, not a scorer
// change.
test.describe('held-out set #3 fixes', () => {
  const wins = async (page: import('@playwright/test').Page, q: string, id: string, locale = 'en') => {
    await page.goto(`/${locale}`)
    await page.getByRole('searchbox').fill(q)
    await page.getByRole('searchbox').press('Enter')
    await expect(page, `"${q}" should open ${id}`).toHaveURL(new RegExp(`/${locale}/apps/${id}$`))
  }

  test('a date converter indexes the word «تاريخ»', async ({ page }) => {
    // It did not, and «حوّل التاريخ للهجري» ranked it SEVENTEENTH.
    await wins(page, 'حوّل التاريخ للهجري', 'hijri-calendar', 'ar')
  })

  test('the Arabic VERB reaches the tool named with the verbal noun', async ({ page }) => {
    // «وقّع» is not a substring of «توقيع» — the documented morphology trap,
    // on the tool whose whole subject it is. It returned NOTHING.
    await wins(page, 'وقّع على عقد', 'pdf-edit', 'ar')
  })

  test('«بالحروف» reaches the tool that writes numbers in letters', async ({ page }) => {
    await wins(page, 'اكتب الرقم بالحروف', 'tafqeet', 'ar')
  })

  test('«تشكيل» goes to the tool that ADDS the marks, not the one that strips them', async ({ page }) => {
    // "A keyword must say what the tool DOES, not what it tolerates."
    // `arabic-normalize` removes harakat and was taking the query off
    // `diacritize`. Asserted at top-3 rather than top-1: the two are 4 points
    // apart and both genuinely concern tashkeel in opposite directions, which
    // the scorer cannot see — the same order-blindness recorded for
    // "html to markdown".
    await page.goto('/en')
    await page.getByRole('searchbox').fill('add harakat to arabic text')
    const ids = await page.locator('[data-testid^="tool-"]').evaluateAll(
      (els) => els.slice(0, 3).map((e) => e.getAttribute('data-testid')!.replace('tool-', '')))
    expect(ids).toContain('diacritize')
  })

  test('a query about a PHOTO does not go to the scanned-PDF tool', async ({ page }) => {
    // `pdf-ocr` carried the keyword `photocopy`, which begins with "photo" and
    // therefore scored as a word-boundary substring on every photo query.
    await wins(page, 'read the text in a photo', 'pdf-ocr')
  })

  test('«مسربة» reaches the tool that checks for a leak', async ({ page }) => {
    await wins(page, 'هل كلمة مروري مسربة', 'password-strength', 'ar')
  })
})

// --- converter direction, 10 August 2026 --------------------------------------
//
// The scorer discards word order BY DESIGN, so "markdown to html" and "html to
// markdown" are the same query to it and whichever NAME contains both nouns
// wins at triple weight — which has nothing to do with which tool is right.
// That failure was found FOUR times one query at a time before
// `evals/directions.mjs` made it measurable: 24/24 own direction, 12/12
// opposite. `Tool.inverse` declares the pairs the naming cannot carry, and
// `scripts/check-inverses.mjs` refuses a one-sided declaration.
test.describe('a converter wins its own direction', () => {
  const opens = async (page: import('@playwright/test').Page, q: string, id: string) => {
    await page.goto('/en')
    await page.getByRole('searchbox').fill(q)
    await page.getByRole('searchbox').press('Enter')
    await expect(page, `"${q}" should open ${id}`).toHaveURL(new RegExp(`/en/apps/${id}$`))
  }

  test('images and pdf, both ways', async ({ page }) => {
    await opens(page, 'images to pdf', 'pdf-merge')
    await opens(page, 'pdf to images', 'pdf-to-images')
  })
})

// --- the shape the query arrives in, 10 August 2026 ---------------------------
//
// Every bench feeds the scorer a clean lower-case phrase and nobody types like
// that. `node evals/inputshapes.mjs` re-asks the 215 queries the benches
// already get right, in the shapes people actually produce. Before the fix:
//
//   trailing ?     51%      trailing .     54%
//   double quoted  10%      «Arabic quotes» 10%   (168 of 215 returned NOTHING)
//   hyphenated     31%      as a URL        0%    (215 of 215 returned NOTHING)
//
// After: 100% on all nine shapes, with every other instrument unchanged —
// `lib/normaliseQuery.ts` touches the QUERY, never the index, which is why it
// cannot move a bench.
test.describe('the query survives its shape', () => {
  const opens = async (page: import('@playwright/test').Page, q: string, id: string, locale = 'en') => {
    await page.goto(`/${locale}`)
    await page.getByRole('searchbox').fill(q)
    await page.getByRole('searchbox').press('Enter')
    await expect(page, `"${q}" should open ${id}`).toHaveURL(new RegExp(`/${locale}/apps/${id}$`))
  }

  test('a question mark does not halve the answer', async ({ page }) => {
    await opens(page, 'merge pdf?', 'pdf-merge')
  })

  test('a full stop does not either', async ({ page }) => {
    await opens(page, 'compress image.', 'image-compressor')
  })

  test('quotes of every family are decoration, not part of the word', async ({ page }) => {
    await opens(page, '"merge pdf"', 'pdf-merge')
    // Guillemets are how Arabic quotes a term — including in this repo's own
    // writing — and they used to return nothing at all.
    await opens(page, '«ضغط الصور»', 'image-compressor', 'ar')
  })

  test('a tool id is a query, because somebody saw it in a URL', async ({ page }) => {
    await opens(page, 'pdf-merge', 'pdf-merge')
    await opens(page, 'video_edit', 'video-edit')
  })

  test('a pasted link finds the tool it points at', async ({ page }) => {
    await opens(page, 'https://built-in-saudi.com/en/apps/pdf-merge', 'pdf-merge')
    await opens(page, '/ar/apps/zakat-calculator', 'zakat-calculator')
  })

  test('a pasted ARABIC link works, which needed the path decoding', async ({ page }) => {
    // `url.pathname` is percent-encoded, so an Arabic segment arrives as
    // %D8%B6%D8%BA%D8%B7… and matches nothing.
    await page.goto('/ar')
    await page.getByRole('searchbox').fill(`https://built-in-saudi.com/ar/apps/${encodeURIComponent('ضغط الصور')}`)
    await expect(page.locator('[data-testid^="tool-"]').first()).toBeVisible()
  })

  test('a bare origin is not treated as a query for its own hostname', async ({ page }) => {
    // "built-in-saudi.com" is not something anybody meant to search for.
    await page.goto('/en')
    await page.getByRole('searchbox').fill('https://built-in-saudi.com/')
    await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
  })

  test('characters that are load-bearing in a term survive', async ({ page }) => {
    // `+966`, `C#` and `3.5` are things people type, so `+`, `#` and an
    // INTERNAL dot are left alone — only trailing punctuation is stripped.
    await page.goto('/en')
    await page.getByRole('searchbox').fill('+966')
    await expect(page.locator('[data-testid^="tool-"]').first()).toBeVisible()
  })
})

test('PDF written phonetically in Arabic finds the PDF tools', async ({ page }) => {
  // «بي دي اف» is how PDF is written in Arabic, and exactly ONE of the fifteen
  // PDF tools indexed it — so an Arabic speaker who spells it out got one
  // arbitrary member of the family. Adding it to every member cannot reorder
  // them against each other; it only lifts them above the tools that are not
  // about PDFs at all.
  await search(page, 'ملف بي دي اف كبير جدا', 'ar')
  await expect(page.getByTestId('tool-pdf-compress')).toBeVisible()
})

// --- A file extension is how people name a format ------------------------------
//
// Held-out set #5 (`evals/untuned5.mjs`) asks for formats the way people type
// them — `.heic`, `xlsx to csv`, `.vcf`. It read 54% top-1 with EIGHT queries
// returning nothing at all, the worst of any set, and it was one mechanism: a
// LEADING DOT makes the query term longer than the indexed word, so it cannot
// match. Exactly the failure the Arabic definite article causes, where «الزكاة»
// could not reach the keyword «زكاة».
//
// Measured: the eight formats scored 270–450 typed bare and about 15 with the
// dot. Stripping it took the set to 80% / 92% with one not-found — `avif`,
// which this site genuinely does not handle, so finding nothing is correct.

test('a format typed as a file extension finds the tool that handles it', async ({ page }) => {
  await search(page, '.heic')
  await expect(page.getByTestId('tool-image-compressor')).toBeVisible()
})

test('and so do the formats that returned nothing at all', async ({ page }) => {
  for (const [ext, id] of [['.pptx', 'powerpoint-editor'], ['.docx', 'word-editor'], ['.vcf', 'csv-vcard']]) {
    await search(page, ext)
    await expect(page.getByTestId(`tool-${id}`)).toBeVisible()
  }
})

// --- A converter must win its OWN direction ------------------------------------
//
// Word order carries the direction and `fuzzy.ts` discards it on purpose, so
// `jpg to pdf` and `pdf to jpg` are the same query to the scorer and the winner
// was decided by a margin that means nothing — 1.3% and 2.7% in the two cases
// held-out set #5 caught.
//
// `Tool.inverse` had been declared on twelve pairs since the direction
// instrument was written and the SCORER never read it; it fed only the harness.
// `lib/searchDirection.ts` is that declaration finally doing something for the
// reader. It is a TIE-BREAK: the two tools must declare each other, be within
// 15% of one another, and exactly one of them must name the destination asked
// for. Measured: it fires on 2 of 387 benched queries and 0 of 456 tool names.

test('a converter wins its own direction, and so does its inverse', async ({ page }) => {
  await search(page, 'jpg to pdf')
  await expect(top(page)).toHaveAttribute('data-testid', 'tool-pdf-merge')

  // The other half matters as much: without it, a tool that simply always
  // flipped the top two would pass the first assertion.
  await search(page, 'pdf to jpg')
  await expect(top(page)).toHaveAttribute('data-testid', 'tool-pdf-to-images')
})

test('the Arabic word for "to" counts as a direction', async ({ page }) => {
  await search(page, 'تحويل pdf إلى صور', 'ar')
  await expect(top(page)).toHaveAttribute('data-testid', 'tool-pdf-to-images')
})

test('a query naming no direction is left exactly as it was', async ({ page }) => {
  // The tie-break must not touch anything else, which is what keeps it from
  // regressing a bench. `pdf` names a family, not a direction.
  await search(page, 'merge pdf')
  await expect(top(page)).toHaveAttribute('data-testid', 'tool-pdf-merge')
})

test('a word that merely BEGINS with a particle letter is left alone', async ({ page }) => {
  // The guard that makes the strip safe. «كتاب» is not ك + تاب, and «كلمة» is
  // not ك + لمة — stripping either would send the query somewhere else
  // entirely.
  await search(page, 'كلمة مرور', 'ar')
  await expect(page.getByTestId('tool-password-generator')).toBeVisible()
})

test('and the diacritics still work when somebody does type them', async ({ page }) => {
  // Folded on BOTH sides, so writing the name properly cannot be worse than
  // writing it plainly. Without this, the fold could have been a one-way strip
  // of the index that broke the careful speller.
  await search(page, 'محوّل العملات', 'ar')
  await expect(page.getByTestId('tool-currency-converter')).toBeVisible()
})

test('a bare number names no shape, and still returns nothing', async ({ page }) => {
  // «250» could be a year, a page count or a salary. Guessing would be the
  // adware move of always showing something — and without this case the fix
  // could have been "answer every query containing a digit".
  await search(page, '250')
  await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
})

// --- The search box has to keep up with typing --------------------------------
//
// Never measured until now: one full search over 233 tools took **11.4ms on a
// desktop**, against a 16.7ms frame — so a mid-range phone, three to six times
// slower, dropped frames on every keystroke. Profiling put 53% of it in the
// keywords (14.4 per tool, ~3,350 scoring calls per search) and the cost was
// per-CALL overhead, not the algorithm: the same field strings were lower-cased
// and run through the diacritic regex again for every tool on every keystroke,
// and the query was re-folded inside each of those calls.
//
// Folding is remembered by content and the query is prepared once per tool.
// **11.42ms → 4.68ms, with every bench byte-identical.**
//
// What that introduces is a cache shared across queries, so these assert it
// cannot leak between them.

test('a cached fold cannot leak between queries', async ({ page }) => {
  await search(page, 'merge pdf')
  await expect(top(page)).toHaveAttribute('data-testid', 'tool-pdf-merge')
  await search(page, 'محول العملات', 'ar')
  await expect(page.getByTestId('tool-currency-converter')).toBeVisible()
  // Back again: a cache that had been poisoned by the Arabic query would show
  // it here.
  await search(page, 'merge pdf')
  await expect(top(page)).toHaveAttribute('data-testid', 'tool-pdf-merge')
})

// --- Held-out set #8: the PRODUCT NAME used as the verb.
//
// The catalogue is written in the vocabulary of the FUNCTION and an enormous
// number of people name a function by the product that made it famous. First
// reading of `evals/untuned8.mjs`: 46% top-1 with 23 of 46 returning NOTHING —
// the lowest of any held-out set. `lib/productAliases.ts` maps a brand to the
// words behind it, as a fallback tried only on an empty result.

test('a product name resolves to the tool that does the same job', async ({ page }) => {
  await search(page, 'tinypng')
  await expect(page.getByTestId('tool-image-compressor')).toBeVisible()
})

test('and so does one written the Arabic way', async ({ page }) => {
  await search(page, 'زووم', 'ar')
  await expect(page.getByTestId('tool-calls')).toBeVisible()
})

test('a product we deliberately do NOT imitate still returns nothing', async ({ page }) => {
  // The precision half, and the reason this file cannot grow into "match any
  // brand anybody types". Photoshop and Canva are not here; answering them with
  // the nearest image tool is the adware move.
  for (const q of ['photoshop', 'canva', 'dropbox', 'figma']) {
    await search(page, q)
    await expect(page.locator('[data-testid^="tool-"]')).toHaveCount(0)
  }
})

test('a brand inside a longer sentence does not hijack the query', async ({ page }) => {
  // One word of scaffolding either side is a brand query; a sentence is not.
  // Beyond that the scorer has a real opinion and it is not ours to overrule.
  await search(page, 'how do i get a zoom recording into a smaller file')
  await expect(page.getByTestId('tool-calls')).toHaveCount(0)
})

test('a query that already works is untouched by the alias layer', async ({ page }) => {
  // The whole reason it cannot regress a bench: it runs ONLY on an empty
  // result. `meet` is an English word before it is a product, and the tools
  // that own it must keep it.
  await search(page, 'meeting')
  const first = page.locator('[data-testid^="tool-"]').first()
  await expect(first).not.toHaveAttribute('data-testid', 'tool-image-compressor')
})

// --- Mechanism cases kept through the November 2026 cut. Each used to be
// pinned on a tool that was removed or merged; the MECHANISM is what they
// guard, so they are re-aimed at a tool that still exists rather than lost.

test('the launcher searches the same way', async ({ page }) => {
  await page.goto('/en/apps/qr-code')
  await page.getByTestId('app-launcher').click()
  await page.getByTestId('launcher-search').fill('merge pdf')
  // The launcher and the home catalogue share one scorer, so a query that works
  // in one has to work in the other.
  await expect(page.getByTestId('tool-pdf-merge')).toBeVisible()
})

test('a shipped capability is findable by its name', async ({ page }) => {
  // The site decodes HEIC everywhere an image is taken (#226); the query an
  // iPhone owner on Android actually types has to find a tool.
  await search(page, 'heic')
  await expect(page.getByTestId('tool-image-compressor')).toBeVisible()
})

test('a substring inside another word is not a match', async ({ page }) => {
  // "old" is inside "Golden Hour" — the mid-word penalty keeps the age
  // calculator first for this.
  await search(page, 'how old am i')
  await expect(page.getByTestId('tool-date-diff')).toBeVisible()
  await expect(top(page)).toHaveAttribute('data-testid', 'tool-date-diff')
})

test('British and American spellings both find the tool', async ({ page }) => {
  await search(page, 'normalise')
  await expect(page.getByTestId('tool-arabic-normalize')).toBeVisible()
})

test('a format this site does not handle still finds nothing', async ({ page }) => {
  // The adware move is to always show something; AVIF is read by no tool here.
  await search(page, 'avif')
  await expect(page.getByTestId('tool-image-compressor')).toHaveCount(0)
})

test('Arabic particles stick to the front of the word, and are stripped', async ({ page }) => {
  // The strip only lands on a word the catalogue already knows, which is what
  // stops it mangling «كتاب» into «تاب».
  await search(page, 'بالهجري', 'ar')
  await expect(page.getByTestId('tool-hijri-calendar')).toBeVisible()
})

test('a tool is findable by its own Arabic name typed without the diacritics', async ({ page }) => {
  await search(page, 'محول العملات', 'ar')
  await expect(page.getByTestId('tool-currency-converter')).toBeVisible()
})

test('and the diacritic fold still applies after many other searches', async ({ page }) => {
  // The cache clears wholesale when it grows past its bound, so the folded
  // fields have to repopulate correctly rather than being lost.
  for (const q of ['pdf', 'image', 'csv', 'zakat', 'qr']) await search(page, q)
  await search(page, 'محول العملات', 'ar')
  await expect(page.getByTestId('tool-currency-converter')).toBeVisible()
})

test('what a merged tool did is still findable in the tool that took it over', async ({ page }) => {
  for (const [q, id] of [
    ['crop image', 'image-edit'], ['convert to webp', 'image-compressor'],
    ['markdown to word', 'word-editor'], ['csv to excel', 'excel-editor'],
    ['pdf to text', 'pdf-ocr'], ['trim video', 'video-edit'],
  ] as const) {
    await search(page, q)
    await expect(page.getByTestId(`tool-${id}`), q).toBeVisible()
  }
})
