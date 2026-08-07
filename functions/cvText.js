// Renders a CV object to the plain text an ATS recovers from the exported PDF
// (src/tools/cv-generator/CvPdf.tsx): same sections, same order, same headings,
// with the **bold** markers dropped since they are font weight in the PDF, not
// literal characters. The scorer grades THIS — the artefact the candidate
// actually sends to employers — rather than our JSON, so a score means the same
// thing whether it came from an upload or from our own rebuild.
// Mirrored by evals/lib/cvText.mjs; keep the two in step.

const strip = (s) => String(s || '').replace(/\*\*/g, '')

export function cvToText(cv) {
  if (!cv || typeof cv !== 'object') return ''
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
  // The PDF renders <Link src={url}>{label}</Link>, so the LABEL is the
  // visible text and the URL lives in the link annotation, which no text
  // extraction recovers. Emitting the URL here credited the scorer with
  // characters the employer's parser never sees.
  for (const l of cv.contact?.links || []) contact.push(l.label)
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
