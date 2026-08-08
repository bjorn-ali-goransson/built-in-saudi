// react-pdf report for the ATS review: the overall score, the six ATS
// dimensions as bars, the issues, and each follow-up question printed with a
// blank box beneath it — the on-screen text areas become fill-in gaps on paper,
// so the candidate can jot answers before running the improve pass. Latin-only
// (reuses the CV's IBM Plex Sans registration), like CvPdf.
import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer'
import type { Cv } from './schema'
import type { CvIssue, CvGap, CvAts } from '../../lib/cvApi'
import { registerCvFonts } from './CvPdf'

const pt = (px: number) => px * 0.75

const C = {
  ink: '#1b2230', inkSoft: '#28303e', accent: '#1e3a5f', muted: '#5c6675',
  line: '#d7dbe2', track: '#e7eaf0', high: '#b42318', med: '#b25e09', low: '#5c6675',
}

const ATS_ORDER = ['keywords', 'impact', 'clarity', 'format', 'completeness', 'conciseness']
const ATS_LABELS: Record<string, string> = {
  keywords: 'Keywords', impact: 'Impact', clarity: 'Clarity',
  format: 'Format', completeness: 'Completeness', conciseness: 'Conciseness',
}
const SEV_LABEL: Record<string, string> = { high: 'Critical', medium: 'Important', low: 'Minor' }
const SEV_COLOR: Record<string, string> = { high: C.high, medium: C.med, low: C.low }

// Score 1–5 → red→amber→green, matching the on-screen heatmap (hsl 0°→120°).
function heatHex(v: number): string {
  const hue = ((Math.max(1, Math.min(5, v || 1)) - 1) / 4) * 120
  const sat = 0.62, lig = 0.42
  const c = (1 - Math.abs(2 * lig - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = lig - c / 2
  let r = 0, g = 0, b = 0
  if (hue < 60) { r = c; g = x } else if (hue < 120) { r = x; g = c } else { g = c; b = x }
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

const s = StyleSheet.create({
  page: { paddingTop: '13mm', paddingBottom: '13mm', paddingLeft: '16mm', paddingRight: '16mm', fontFamily: 'IBM Plex Sans', fontSize: pt(12), color: C.ink, lineHeight: 1.4 },
  header: { paddingBottom: pt(10), borderBottomWidth: 1.5, borderBottomColor: C.accent },
  title: { fontSize: pt(24), fontWeight: 700, letterSpacing: pt(24) * 0.02, textTransform: 'uppercase', color: C.accent },
  sub: { marginTop: pt(4), fontSize: pt(12.5), color: C.muted },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: pt(16) },
  big: { fontSize: pt(34), fontWeight: 700, color: C.accent },
  big5: { fontSize: pt(14), color: C.muted, marginLeft: pt(4) },
  overallLbl: { fontSize: pt(11.5), color: C.muted, marginLeft: pt(10), textTransform: 'uppercase', letterSpacing: pt(11.5) * 0.06 },
  section: { marginTop: pt(16) },
  // 0.08em, not 0.14: above ~0.12em at heading size a PDF text extractor
  // reads the glyph gaps as spaces and "WHAT NEEDS YOUR ANSWER" comes back as
  // "W H AT N E E D S". Measured — see CLAUDE.md and evals/pdfguard.mjs.
  secHead: { fontSize: pt(10.5), fontWeight: 700, textTransform: 'uppercase', letterSpacing: pt(10.5) * 0.08, color: C.accent, marginBottom: pt(7) },
  secLead: { fontSize: pt(11), color: C.muted, marginTop: pt(-3), marginBottom: pt(8) },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: pt(6) },
  barLabel: { width: pt(96), fontSize: pt(11), color: C.inkSoft },
  track: { flex: 1, height: pt(8), borderRadius: pt(4), backgroundColor: C.track },
  fill: { height: pt(8), borderRadius: pt(4) },
  barVal: { width: pt(28), textAlign: 'right', fontSize: pt(10.5), color: C.muted },
  issue: { marginBottom: pt(8) },
  issueHead: { flexDirection: 'row', alignItems: 'baseline' },
  issueTitle: { flex: 1, fontSize: pt(12), fontWeight: 600, color: C.ink },
  sev: { fontSize: pt(9), fontWeight: 700, textTransform: 'uppercase', letterSpacing: pt(9) * 0.05, marginLeft: pt(8) },
  issueDetail: { marginTop: pt(2), fontSize: pt(11), color: C.inkSoft, lineHeight: 1.35 },
  gap: { marginBottom: pt(11) },
  gapQ: { fontSize: pt(12), color: C.ink },
  gapWhy: { color: C.muted },
  gapBox: { marginTop: pt(5), height: pt(46), borderWidth: 1, borderColor: C.line, borderRadius: pt(3) },
  foot: { position: 'absolute', bottom: '8mm', left: '16mm', right: '16mm', textAlign: 'center', fontSize: pt(9), color: C.muted },
})

export function AtsReportDoc({ cv, ats, issues, gaps }: { cv: Cv; ats: CvAts; issues: CvIssue[]; gaps: CvGap[] }) {
  const overall = Math.round((ATS_ORDER.reduce((a, k) => a + (ats[k] || 0), 0) / ATS_ORDER.length) * 10) / 10
  return (
    <Document title={`ATS report — ${cv.name || 'CV'}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>ATS Report</Text>
          <Text style={s.sub}>{cv.name || 'Candidate'}{cv.role ? ` — ${cv.role}` : ''}</Text>
        </View>

        <View style={s.scoreRow}>
          <Text style={s.big}>{overall}</Text>
          <Text style={s.big5}>/ 5</Text>
          <Text style={s.overallLbl}>Overall ATS score</Text>
        </View>

        <View style={s.section}>
          {ATS_ORDER.map((k) => {
            const v = ats[k] || 0
            return (
              <View key={k} style={s.barRow}>
                <Text style={s.barLabel}>{ATS_LABELS[k]}</Text>
                <View style={s.track}><View style={[s.fill, { width: `${(v / 5) * 100}%`, backgroundColor: heatHex(v) }]} /></View>
                <Text style={s.barVal}>{v}/5</Text>
              </View>
            )
          })}
        </View>

        {issues.length ? (
          <View style={s.section}>
            <Text style={s.secHead}>What needs you</Text>
            {issues.map((i, n) => (
              <View key={n} style={s.issue} wrap={false}>
                <View style={s.issueHead}>
                  <Text style={s.issueTitle}>{n + 1}. {i.title}</Text>
                  <Text style={[s.sev, { color: SEV_COLOR[i.severity] || C.muted }]}>{SEV_LABEL[i.severity] || i.severity}</Text>
                </View>
                {i.detail ? <Text style={s.issueDetail}>{i.detail}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {gaps.length ? (
          <View style={s.section}>
            <Text style={s.secHead}>Answer to raise your ATS score</Text>
            <Text style={s.secLead}>Write in each box — add a number where you can (e.g. cut costs ~15%).</Text>
            {gaps.map((g, n) => (
              <View key={g.id} style={s.gap} wrap={false}>
                <Text style={s.gapQ}>{n + 1}. {g.question}{g.why ? <Text style={s.gapWhy}>{`  (${g.why})`}</Text> : null}</Text>
                <View style={s.gapBox} />
              </View>
            ))}
          </View>
        ) : null}

        <Text style={s.foot} fixed>Generated by the ATS CV Optimizer · built-in-saudi.com</Text>
      </Page>
    </Document>
  )
}

/** Render the ATS review (score + issues + questions-as-gaps) to a PDF Blob. */
export async function atsReportToPdfBlob(cv: Cv, ats: CvAts, issues: CvIssue[], gaps: CvGap[]): Promise<Blob> {
  registerCvFonts()
  return pdf(<AtsReportDoc cv={cv} ats={ats} issues={issues} gaps={gaps} />).toBlob()
}
