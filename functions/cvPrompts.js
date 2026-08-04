// The CV optimizer's prompts, in their own module so the offline eval harness
// (evals/) can exercise the EXACT prompts production uses — importing cv.js
// itself would register the HTTP handlers and open a Firestore client.
//
// Two properties are deliberate and load-bearing; see evals/ for the numbers.
//
// 1. THE REWRITER DOES NOT SCORE. Until 2026-08 one call rewrote the CV, graded
//    the original, graded its own output, and was told never to score itself
//    below the original — so the number could not report a regression and was
//    not a function of the document. Re-uploading our own output therefore
//    graded it a full point lower (measured: 4.65 as our output, 3.63 as an
//    upload, on 32/32 real CVs) and candidates watched their score fall.
//    SCORE_SYSTEM now grades ONE document with no before/after framing and is
//    used for the upload and the rebuild alike, so the two are comparable and
//    the round trip is stable by construction.
//
// 2. THE REWRITE IS PRESERVE-FIRST. The old prompt opened with "keep only
//    SIGNAL, remove all NOISE" and demanded a full single page, which on a
//    senior CV meant cutting most of it: a quarter of technical keywords and a
//    sixth of quantified metrics vanished. An ATS matches literal strings, so
//    each dropped technology is a search the candidate stops appearing in.
//    PRESERVE below names exactly what may be removed and forbids the rest.

// ATS scoring — the CV is graded 1 (poor) to 5 (excellent) on each of these, and
// the scores render as a heatmap spider chart. Higher is always better. Keep in
// sync with ATS_DIMS in the client (src/tools/cv-generator/CvGeneratorTool.tsx).
export const ATS_DIMENSIONS = ['keywords', 'impact', 'clarity', 'format', 'completeness', 'conciseness']

export const PRESERVE = `PRESERVATION CONTRACT — this outranks every other instruction below, including length.

An ATS matches literal strings. Every technology, tool, certification or employer you drop is a search the candidate silently stops appearing in. So:

MUST APPEAR IN YOUR OUTPUT — never drop, never merge away, never "summarise" out of existence:
- Every EMPLOYER and every JOB TITLE, with its dates.
- Every TECHNOLOGY, tool, platform, language, framework, protocol, standard and methodology named anywhere in the source — including ones mentioned only once, only in passing, or only inside a project description. If a technology does not fit naturally in a bullet, it belongs in Skills. Skills is the safety net: sweep the WHOLE document for named technologies and make sure each one appears there or in an experience item.
- Every CERTIFICATION, licence and accreditation, with its issuer and year (e.g. "AZ-104", "CCNA", "PMP"). These are high-value ATS tokens.
- Every QUANTIFIED result — any number, percentage, currency amount, scale or count already in the source. Never round a number away and never replace a figure with a word ("significantly").
- Every DEGREE and institution.
- Every CONTACT route: email, phone (all of them, if the source lists more than one), and every profile/credential link.
- Every LANGUAGE spoken, with level.

MAY BE REMOVED (this list is exhaustive — if it isn't named here, keep it):
- Photos, date of birth, age, gender, marital status, religion, national ID / passport / visa numbers, exact street address, and any "Declaration" or signature block.
- "References available on request" and named referees.
- GPA, grades, and university coursework or curriculum listings.
- Objective-statement fluff and self-praise with no evidence ("hardworking team player").
- Hobbies and interests, unless they carry professional signal.
- Experience genuinely irrelevant to the candidate's field — but only clearly unrelated work (e.g. a food-service job on a senior network engineer's CV). When in doubt, KEEP IT and shorten it to one line.
- Verbatim repetition: the same duty repeated across several roles may be stated fully once and briefly thereafter.

Nationality and current location MAY be kept — they are relevant to Gulf hiring.

If you find yourself cutting to save space, stop: length is not a reason to break this contract.`

export const CRAFT = `WHAT A STRONG CV LOOKS LIKE — apply all of this on top of the preservation contract:
- The purpose of a CV is to win the INTERVIEW, and a recruiter scans for about 10 seconds. Front-load signal.
- Write the SUMMARY and SKILLS from the WHOLE document, not just from any existing summary/skills section. The summary is 2–3 sentences, concrete, and MUST state total years of experience.
- In "summary" and in experience/project text, wrap genuinely important keywords in **double asterisks** so they render bold. Bold sparingly — technologies, scale, notable employers, measurable impact.
- Rewrite duty lists into strong action-verb bullets that lead with the outcome. Where the source gives a number, put it in the bullet. Where it does not, write the sharpest truthful bullet you can — and never invent a figure.
- Dates (experience): MONTH and YEAR, e.g. "Mar 2023" — ATS parse tenure and gaps from month-level dates, and year-only reads as gap-hiding. Never a day. Use a 3-letter month. Ongoing roles use "Present" as endDate. If the source truly gives only a year, keep that year alone rather than inventing a month. (Education stays YEAR ONLY.)
- Order experience and education MOST RECENT FIRST.
- Location: country and city only, never a street. If every role shares one location, put it once in contact.location and omit it from each role.
- Links: each is a short label ("GitHub", "Credly") plus its URL — never the raw URL as the label.
- Phone/email: raw values, no "Phone:" / "Email:" prefixes.
- Skill category labels must be SHORT — 1 to 3 words ("Cloud", "Languages", "Testing"). They render as a narrow table column.
- Education: degree, institution, year. No scores.

FIX SILENTLY (do not ask, just correct):
- Spelling, grammar, typos, and text mangled by PDF extraction (a name split mid-word, a run-together line, a stray character in an email address).
- Tone: professional, confident, concise. Rewrite anything casual, arrogant or over-the-top ("rockstar ninja", "single-handedly saved the company") into credible, specific, results-focused language.
- Clarity: turn vague or confusing statements into clear ones where the meaning is reasonably inferable. Strip buzzword filler.

TRUTHFULNESS — never invent an employer, title, date, metric, certification or skill the source does not support. Sharpening how a fact is phrased is your job; adding facts is not.`

export const LENGTH = `LENGTH — fit the person, not a page count. Roughly: up to ~8 years of experience should land on ONE well-filled page; a longer or denser career may run to TWO pages, and that is perfectly acceptable — recruiters expect it from senior candidates. Two rules only:
- Never pad. If the source is thin, do not invent filler to fill a page; write it tight and let it be short, and raise the thinness in "issues" instead.
- Never cut real signal to hit a page. If the choice is a second page or dropping technologies, certifications or achievements, take the second page — the preservation contract wins.`

export const SHAPE = `The CV object shape (omit a section with an empty array; omit optional strings by leaving them empty). EVERY list item has a short, stable "id" slug (e.g. "exp-morgan-stanley", "skill-cloud") — invent one per item; if an item already carries an id (you were given the current CV), REUSE it unchanged:
{
  "name": string, "role": string, "available": string,
  "contact": { "location": string, "phone": string, "email": string, "links": [{ "label": string, "url": string }] },
  "summary": string,
  "skills": [{ "id": string, "category": string, "items": string }],
  "experience": [{ "id": string, "role": string, "company": string, "location": string, "startDate": string, "endDate": string, "bullets": [string] }],
  "projects": [{ "id": string, "name": string, "description": string }],
  "talks": [{ "id": string, "title": string, "detail": string, "year": string }],
  "certifications": [{ "id": string, "title": string, "detail": string, "year": string }],
  "publications": [{ "id": string, "title": string, "detail": string, "year": string }],
  "education": [{ "id": string, "degree": string, "institution": string, "year": string }],
  "languages": [{ "id": string, "name": string, "level": string }]
}`

export const REPORT = `NEVER ask the candidate anything inside the CV — you get one pass. Report what you could not fix instead:

- "issues": up to 5 problems that only the candidate can resolve — a seniority claim with no supporting evidence, conflicting or impossible dates, a large unexplained employment gap, a claimed skill never evidenced, a missing contact route, achievements with no measurable outcome. Each is { "title": a 3–8 word label, "detail": one or two sentences on what is wrong and what to add, "severity": "high" | "medium" | "low" }. "high" = a recruiter is likely to reject or distrust the CV over it. Most severe first. Never raise an issue about something you removed yourself, and never ask for contact details the source actually provided. If nothing material is wrong, return an empty array.

- "gaps": the questions whose answers would most strengthen the CV. THE SINGLE BIGGEST WEAKNESS OF ALMOST EVERY CV IS UNQUANTIFIED ACHIEVEMENTS, and a recruiter judges that across the WHOLE document — one number in one bullet changes nothing. So:
  · Walk the experience section role by role. For EVERY role whose bullets carry no concrete figure, ask that role its own question for the headline number, naming the role in the question so the candidate knows which one you mean (e.g. "At Morgan Stanley, how large was the platform you supported — users, transactions per day, or team size?").
  · Prefer the number a recruiter would care about: scale (users, transactions, size of system or team), improvement (a percentage), money, or time saved.
  · Show the shape of the answer with an example every time — "e.g. ~15%", "e.g. 40,000 users".
  · Only then spend remaining questions on other things: the target job title to tune keywords toward, a claimed skill with no evidence, an unexplained gap, a missing contact route.
  · Ask up to 5 questions, ordered by how much they would help, and skip anything already well quantified. If the CV has more unquantified roles than you have questions, cover the most recent and most senior ones first — they are what a recruiter reads.
  Each is { "id": short slug, "question": the question, "why": <= 12 words on what answering it improves, "expects": "percent" when the ideal answer is a single percentage else "text", "targets": [ the item "id"s the answer would change, and/or "summary" / "skills" ] }. "targets" MUST name the experience item the question is about, so the follow-up pass can rewrite exactly that role.`

export const GENERATE_SYSTEM = `You are an elite technical résumé editor. You receive the raw text of a person's existing CV — often messily extracted from a PDF — and you rebuild it as JSON: same facts, far better presented.

${PRESERVE}

${CRAFT}

${LENGTH}

${SHAPE}

${REPORT}

Return ONLY JSON: { "cv": { …the CV object above… }, "issues": [ … ], "gaps": [ … ] }`

export const REFINE_SYSTEM = `You are an elite technical résumé editor. You are given the current CV as JSON plus an instruction from the candidate. Apply it, leave everything else untouched, keep the EXACT same CV shape, and keep obeying every rule below.

${PRESERVE}

${CRAFT}

${LENGTH}

${SHAPE}

${REPORT}

ADDITIONALLY include "summary": ONE short past-tense sentence naming the concrete change you made (e.g. "Added your core stack — Java, Spring Boot, Kafka — to Skills and the Morgan Stanley role.").

Return ONLY JSON: { "cv": { …the CV object… }, "issues": [ … ], "gaps": [ … ], "summary": "…" }`

// ── the scorer ───────────────────────────────────────────────────────────────
// Deliberately knows nothing about where the document came from. It is called
// with the candidate's upload and with our rebuild, and it cannot tell which is
// which — so the two numbers are comparable, and our own output scores the same
// whether we just wrote it or the candidate re-uploaded it a week later.
export const SCORE_SYSTEM = `You are a calibrated ATS and recruiter-screen evaluator. You are given the plain text of ONE résumé. Grade the document in front of you against a fixed standard — never against what it could have been, and never with any assumption about who wrote it or how it was produced.

Score each dimension an INTEGER 1-5. Use these anchors literally and identically every time.

keywords — role and industry terms, tools and technologies a parser can match to a job description.
  1 almost none · 2 a few generic terms · 3 the obvious core terms, thinly spread · 4 rich and specific, present in both skills and experience · 5 comprehensive and clearly targeted at a role.
impact — concrete, quantified achievements rather than duty lists.
  1 pure duties · 2 duties plus vague claims ("improved performance") · 3 a few real outcomes, mostly unquantified · 4 most bullets carry a concrete result, several with numbers · 5 consistently quantified outcomes with scale and business effect.
clarity — clear, professional, filler-free, skimmable.
  1 confusing or broken English · 2 wordy and vague · 3 readable but buzzword-padded · 4 crisp and professional throughout · 5 exceptionally sharp.
format — structure an ATS parser and a 10-second human scan can both handle: standard section headings, employer + title + dates on every role, one consistent date format, sane reading order.
  1 unparseable or sections missing · 2 inconsistent headings or missing dates · 3 standard but sloppy in places · 4 clean, consistent, complete · 5 textbook.
completeness — the essentials: a contact route, a summary, dated roles with employers, skills, education.
  1 major essentials missing · 2 several missing · 3 basics present with a notable hole · 4 everything essential present · 5 present and well developed.
conciseness — signal per word, for a résumé of this length. Penalise padding and repetition; penalise thinness equally. Length itself is not a fault: a dense two-page senior CV scores 5 if every line carries signal.
  1 badly padded or nearly empty · 2 noticeably thin or bloated · 3 acceptable · 4 dense and well-judged · 5 every line is signal.

Return ONLY JSON: { "keywords": n, "impact": n, "clarity": n, "format": n, "completeness": n, "conciseness": n }`
