// Renders a Cv JSON object to the plain text an ATS parser would recover from
// the exported PDF (CvPdf.tsx): same sections, same order, same headings, with
// the **bold** markers stripped (they are font weight in the PDF, not literal
// asterisks). This is what we feed the blind judge and the round-trip run, so
// the judge grades the artefact the candidate actually sends to employers.

const strip = (s) => String(s || '').replace(/\*\*/g, '')

export function cvToText(cv) {
  const L = []
  const section = (title, lines) => {
    if (!lines.length) return
    L.push('', title.toUpperCase(), ...lines)
  }

  if (cv.name) L.push(strip(cv.name).toUpperCase())

  const contact = []
  if (cv.contact?.location) contact.push(cv.contact.location)
  if (cv.contact?.phone) contact.push(cv.contact.phone)
  if (cv.contact?.email) contact.push(cv.contact.email)
  for (const l of cv.contact?.links || []) contact.push(`${l.label} (${l.url})`)
  if (contact.length) L.push(contact.join('   |   '))

  const headline = [cv.role, cv.available].filter(Boolean).map(strip)
  if (headline.length) L.push(headline.join('   |   '))

  if (cv.summary) section('Summary', [strip(cv.summary)])

  section('Skills', (cv.skills || []).map((g) => `${strip(g.category)}: ${strip(g.items)}`))

  section(
    'Experience',
    (cv.experience || []).flatMap((j) => {
      const dates = j.startDate && j.endDate && j.startDate !== j.endDate
        ? `${j.startDate} – ${j.endDate}`
        : j.startDate || j.endDate || ''
      const head = `${strip(j.role)}, ${strip(j.company)}${j.location ? ` (${j.location})` : ''}${dates ? `   ${dates}` : ''}`
      return [head, ...(j.bullets || []).map((b) => `• ${strip(b)}`)]
    }),
  )

  section('Projects', (cv.projects || []).map((p) => `${strip(p.name)} — ${strip(p.description)}`))

  const dated = (items) => (items || []).map((c) => `${strip(c.title)}${c.detail ? ` · ${strip(c.detail)}` : ''}${c.year ? `   ${c.year}` : ''}`)
  section('Talks', dated(cv.talks))
  section('Certifications', dated(cv.certifications))
  section('Publications', dated(cv.publications))

  // An entry may carry only an institution (see normalize) — join on " · " only
  // when both halves exist, or the line opens with a stray separator.
  section('Education', (cv.education || []).map((e) => `${[strip(e.degree), strip(e.institution)].filter(Boolean).join(' · ')}${e.year ? `   ${e.year}` : ''}`))

  const langs = (cv.languages || []).map((l) => `${strip(l.name)}${l.level ? ` (${l.level})` : ''}`)
  if (langs.length) section('Languages', [langs.join('  ·  ')])

  return L.join('\n').trim()
}

/** Body word count — the LENGTH_RULE target ("roughly 300+ words of body
 *  content, not counting name/headline/contact"). */
export function bodyWordCount(cv) {
  const parts = [
    cv.summary,
    ...(cv.skills || []).map((g) => `${g.category} ${g.items}`),
    ...(cv.experience || []).flatMap((j) => [j.role, j.company, ...(j.bullets || [])]),
    ...(cv.projects || []).map((p) => `${p.name} ${p.description}`),
    ...['talks', 'certifications', 'publications'].flatMap((k) => (cv[k] || []).map((c) => `${c.title} ${c.detail || ''}`)),
    ...(cv.education || []).map((e) => `${e.degree} ${e.institution || ''}`),
  ]
  return strip(parts.filter(Boolean).join(' ')).split(/\s+/).filter(Boolean).length
}
