// react-pdf renderer for a Cv — the vector, selectable-text PDF the user
// downloads. It mirrors template.ts (the on-screen/print HTML) so the download
// matches the preview: same A4 layout, IBM Plex Sans, colours and sizes.
//
// The HTML template sizes everything in CSS px; print maps 1px = 0.75pt (96→72
// dpi), so pt() converts the template's px numbers straight into PDF points.
import { Document, Page, View, Text, Link, Font, StyleSheet, pdf } from '@react-pdf/renderer'
import type { Cv } from './schema'

const pt = (px: number) => px * 0.75

const C = {
  ink: '#1b2230',
  inkSoft: '#28303e',
  accent: '#1e3a5f',
  accent2: '#2f5482',
  muted: '#5c6675',
  line: '#d7dbe2',
}

// IBM Plex Sans, subset to Latin, bundled in public/fonts (react-pdf's fontkit
// needs static TTF — the Google/IBM packages now ship only woff2). Registered
// once, lazily, so importing this module doesn't fetch fonts until an export.
let fontsReady = false
export function registerCvFonts(base = `${import.meta.env.BASE_URL}fonts/`) {
  if (fontsReady) return
  fontsReady = true
  Font.register({
    family: 'IBM Plex Sans',
    fonts: [
      { src: `${base}ibm-plex-sans-400.ttf`, fontWeight: 400 },
      { src: `${base}ibm-plex-sans-500.ttf`, fontWeight: 500 },
      { src: `${base}ibm-plex-sans-600.ttf`, fontWeight: 600 },
      { src: `${base}ibm-plex-sans-700.ttf`, fontWeight: 700 },
    ],
  })
  // Don't hyphenate — résumés shouldn't break "JavaScript" as "Java-Script".
  Font.registerHyphenationCallback((word) => [word])
}

const s = StyleSheet.create({
  page: {
    paddingTop: '13mm', paddingBottom: '13mm', paddingLeft: '16mm', paddingRight: '16mm',
    fontFamily: 'IBM Plex Sans', fontSize: pt(12), color: C.ink, lineHeight: 1.45,
  },
  // Header
  header: { textAlign: 'center', paddingBottom: pt(11), borderBottomWidth: 1.5, borderBottomColor: C.accent },
  name: { fontSize: pt(28), fontWeight: 700, letterSpacing: pt(28) * 0.035, textTransform: 'uppercase', color: C.accent, lineHeight: 1.08 },
  contact: { marginTop: pt(9), fontSize: pt(11.5), color: C.muted, lineHeight: 1.4 },
  clink: { color: C.ink, textDecoration: 'underline' },
  sep: { color: C.line },
  headline: { marginTop: pt(6), fontSize: pt(12.5), fontWeight: 600, color: C.ink, lineHeight: 1.4 },
  hRole: { color: C.accent },
  // Sections
  section: { marginTop: pt(16) },
  secHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: pt(6) },
  secHead: { fontSize: pt(10.5), fontWeight: 700, textTransform: 'uppercase', letterSpacing: pt(10.5) * 0.15, color: C.accent },
  secRule: { flex: 1, height: 1, backgroundColor: C.line, marginLeft: pt(12) },
  // Summary
  summary: { fontSize: pt(12.25), lineHeight: 1.4, color: C.inkSoft },
  bold: { fontWeight: 700, color: C.ink },
  // Skills
  skillRow: { flexDirection: 'row', marginBottom: pt(3) },
  dt: { width: pt(150), marginRight: pt(16), fontSize: pt(10), fontWeight: 600, letterSpacing: pt(10) * 0.04, textTransform: 'uppercase', color: C.accent2, paddingTop: 1.5 },
  dd: { flex: 1, fontSize: pt(12.25), color: C.ink, lineHeight: 1.4 },
  // Experience
  job: { marginTop: pt(7) },
  jobHead: { flexDirection: 'row', justifyContent: 'space-between' },
  jobMeta: { flex: 1, fontSize: pt(12.5), color: C.ink, lineHeight: 1.35 },
  jRole: { fontWeight: 700, color: C.ink },
  jCo: { color: C.accent, fontWeight: 500 },
  jLoc: { color: C.muted },
  jobDates: { fontSize: pt(11), color: C.muted, marginLeft: pt(12), paddingTop: 0.5 },
  li: { flexDirection: 'row', marginBottom: pt(2.5) },
  bullet: { width: pt(4), height: pt(4), borderRadius: 1, backgroundColor: C.accent2, marginTop: pt(12) * 0.5, marginLeft: pt(2), marginRight: pt(9) },
  liText: { flex: 1, fontSize: pt(12), lineHeight: 1.34, color: C.inkSoft },
  // Projects
  project: { marginTop: pt(5) },
  projLine: { fontSize: pt(12), lineHeight: 1.34, color: C.inkSoft },
  projName: { color: C.accent, fontWeight: 500 },
  // Rows (dated / education)
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: pt(4) },
  rowLeft: { flex: 1, fontSize: pt(12.5), color: C.ink },
  deg: { fontWeight: 600, color: C.ink },
  inst: { fontSize: pt(12), color: C.muted, fontWeight: 400 },
  year: { fontSize: pt(11), color: C.muted, marginLeft: pt(14) },
  // Languages
  langs: { fontSize: pt(12.25), color: C.ink, lineHeight: 1.4 },
})

// react-pdf inserts a stray space at a junction between two inline <Text> runs
// when BOTH sides are non-whitespace (e.g. "Engineer"|", " → "Engineer , ", or a
// bold word followed by a lone "." → "word ."). We avoid every such junction by
// gluing punctuation across the boundary onto a neighbouring run (bolding a comma
// or bracket is imperceptible), so no boundary is non-space|non-space.
type RStyle = (typeof s)[keyof typeof s]
type Run = { t: string; s?: RStyle }

function normalizeRuns(runs: Run[]): Run[] {
  const r = runs.filter((x) => x.t.length > 0)
  for (let i = 0; i < r.length - 1; i++) {
    const a = r[i], b = r[i + 1]
    if (/\s$/.test(a.t) || /^\s/.test(b.t)) continue // boundary already has a space
    const bLead = b.t.match(/^[^\p{L}\p{N}\s]+/u)
    if (bLead) { a.t += bLead[0]; b.t = b.t.slice(bLead[0].length) }
    else {
      const aTrail = a.t.match(/[^\p{L}\p{N}\s]+$/u)
      if (aTrail) { b.t = aTrail[0] + b.t; a.t = a.t.slice(0, -aTrail[0].length) }
    }
  }
  return r.filter((x) => x.t.length > 0)
}

function Runs({ runs }: { runs: Run[] }) {
  return <>{normalizeRuns(runs).map((x, i) => <Text key={i} style={x.s}>{x.t}</Text>)}</>
}

/** Split **markdown bold** into runs, then render (normalised) inside a <Text>. */
function richRuns(text: string): Run[] {
  const runs: Run[] = []
  const re = /\*\*([^*]+)\*\*/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ t: text.slice(last, m.index) })
    runs.push({ t: m[1], s: s.bold })
    last = re.lastIndex
  }
  if (last < text.length) runs.push({ t: text.slice(last) })
  return runs
}
function Rich({ text }: { text: string }) {
  return <Runs runs={richRuns(text)} />
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.secHeadRow}>
        <Text style={s.secHead}>{title}</Text>
        <View style={s.secRule} />
      </View>
      {children}
    </View>
  )
}

function datesLabel(a?: string, b?: string): string {
  if (a && b && a !== b) return `${a} – ${b}`
  return a || b || ''
}

function ContactLine({ cv }: { cv: Cv }) {
  const nodes: React.ReactNode[] = []
  const push = (node: React.ReactNode) => {
    if (nodes.length) nodes.push(<Text key={`s${nodes.length}`} style={s.sep}>{'   |   '}</Text>)
    nodes.push(node)
  }
  if (cv.contact.location) push(<Text key="loc">{cv.contact.location}</Text>)
  if (cv.contact.phone) push(<Link key="ph" src={`tel:${cv.contact.phone}`} style={s.clink}>{cv.contact.phone}</Link>)
  if (cv.contact.email) push(<Link key="em" src={`mailto:${cv.contact.email}`} style={s.clink}>{cv.contact.email}</Link>)
  for (const [i, l] of (cv.contact.links || []).entries()) push(<Link key={`l${i}`} src={l.url} style={s.clink}>{l.label}</Link>)
  return <Text style={s.contact}>{nodes}</Text>
}

export function CvDocument({ cv }: { cv: Cv }) {
  const skills = cv.skills || []
  const experience = cv.experience || []
  const projects = cv.projects || []
  const talks = cv.talks || []
  const certs = cv.certifications || []
  const pubs = cv.publications || []
  const education = cv.education || []
  const languages = cv.languages || []

  const DatedRows = ({ items }: { items: Cv['certifications'] }) => (
    <>
      {items.map((c, i) => (
        <View key={i} style={s.row} wrap={false}>
          <Text style={s.rowLeft}>
            <Text style={s.deg}>{c.title}</Text>
            {c.detail ? <Text style={s.inst}>{` · ${c.detail}`}</Text> : null}
          </Text>
          {c.year ? <Text style={s.year}>{c.year}</Text> : null}
        </View>
      ))}
    </>
  )

  return (
    <Document title={`${cv.name} — CV`} author={cv.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{cv.name}</Text>
          <ContactLine cv={cv} />
          <Text style={s.headline}>
            <Text style={s.hRole}>{cv.role}</Text>
            {cv.available ? <Text>{'   |   '}{cv.available}</Text> : null}
          </Text>
        </View>

        {cv.summary ? (
          <Section title="Summary"><Text style={s.summary}><Rich text={cv.summary} /></Text></Section>
        ) : null}

        {skills.length ? (
          <Section title="Skills">
            {skills.map((g, i) => (
              <View key={i} style={s.skillRow} wrap={false}>
                <Text style={s.dt}>{g.category}</Text>
                <Text style={s.dd}>{g.items}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {experience.length ? (
          <Section title="Experience">
            {experience.map((j, i) => (
              <View key={i} style={s.job} wrap={false}>
                <View style={s.jobHead}>
                  <Text style={s.jobMeta}>
                    <Runs runs={[
                      { t: j.role, s: s.jRole },
                      { t: ', ' },
                      { t: j.company, s: s.jCo },
                      ...(j.location ? [{ t: ` (${j.location})`, s: s.jLoc }] : []),
                    ]} />
                  </Text>
                  <Text style={s.jobDates}>{datesLabel(j.startYear, j.endYear)}</Text>
                </View>
                <View>
                  {(j.bullets || []).map((b, bi) => (
                    <View key={bi} style={s.li}>
                      <View style={s.bullet} />
                      <Text style={s.liText}><Rich text={b} /></Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {projects.length ? (
          <Section title="Projects">
            {projects.map((p, i) => (
              <View key={i} style={s.project} wrap={false}>
                <Text style={s.projLine}>
                  <Text style={s.projName}>{p.name}</Text>
                  <Text>{' — '}</Text>
                  <Rich text={p.description} />
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {talks.length ? <Section title="Talks"><DatedRows items={talks} /></Section> : null}
        {certs.length ? <Section title="Certifications"><DatedRows items={certs} /></Section> : null}
        {pubs.length ? <Section title="Publications"><DatedRows items={pubs} /></Section> : null}

        {education.length ? (
          <Section title="Education">
            {education.map((e, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={s.rowLeft}>
                  <Text style={s.deg}>{e.degree}</Text>
                  {e.institution ? <Text style={s.inst}>{` · ${e.institution}`}</Text> : null}
                </Text>
                {e.year ? <Text style={s.year}>{e.year}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {languages.length ? (
          <Section title="Languages">
            <Text style={s.langs}>{languages.map((l) => l.name + (l.level ? ` (${l.level})` : '')).join('  ·  ')}</Text>
          </Section>
        ) : null}
      </Page>
    </Document>
  )
}

/** Render a Cv to a PDF Blob (fonts are registered on first call). */
export async function cvToPdfBlob(cv: Cv): Promise<Blob> {
  registerCvFonts()
  return pdf(<CvDocument cv={cv} />).toBlob()
}
