// Deterministic retention checks — no model in the loop, so these can't be
// argued with. An ATS matches literal strings: every acronym, product name,
// certification code and metric that exists in the source but not in the output
// is a match the candidate can no longer win.

const norm = (s) => String(s || '').replace(/\*\*/g, '').toLowerCase()

/** Uppercase/CamelCase technical tokens: CCNA, AWS, TCP/IP, Kubernetes, .NET,
 *  C#, SIEM. Deliberately over-inclusive — false positives are diluted by the
 *  ratio, false negatives would hide real losses. */
export function techTokens(text) {
  const out = new Set()
  const src = String(text || '').replace(/\*\*/g, '')
  // Acronyms and product codes: 2+ chars, at least one uppercase, may carry
  // digits, dots, slashes, pluses, hashes (C++, TCP/IP, .NET, ISO27001).
  for (const m of src.matchAll(/\b[A-Z][A-Za-z0-9]*(?:[./+#-][A-Za-z0-9]+)*\b/g)) {
    const t = m[0]
    if (t.length < 2) continue
    // All-caps 2-6 (acronyms) or mixed-case with an internal capital/digit.
    const acronym = /^[A-Z0-9./+#-]{2,8}$/.test(t)
    const productish = /[a-z]/.test(t) && /[A-Z0-9./+#]/.test(t.slice(1))
    if (acronym || productish) out.add(t.toLowerCase())
  }
  for (const m of src.matchAll(/\b(?:c\+\+|c#|\.net|node\.js|next\.js|vue\.js)\b/gi)) out.add(m[0].toLowerCase())
  // Drop calendar noise and generic English that survives the shape test.
  const STOP = new Set(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'i', 'a', 'the', 'and', 'to', 'of', 'in', 'at', 'on', 'as', 'by', 'cv', 'mr', 'ms', 'dr'])
  for (const t of [...out]) if (STOP.has(t) || /^\d+$/.test(t)) out.delete(t)
  return out
}

/** Quantified achievements: percentages, money, multipliers, counts with a unit
 *  or scale word. These are the "impact" evidence — losing one is a direct hit. */
export function metrics(text) {
  const out = new Set()
  const src = String(text || '').replace(/\*\*/g, '')
  for (const m of src.matchAll(/\b\d+(?:[.,]\d+)?\s?%/g)) out.add(m[0].replace(/\s/g, ''))
  for (const m of src.matchAll(/[$€£]\s?\d[\d.,]*\s?[kmb]?\b/gi)) out.add(m[0].replace(/\s/g, '').toLowerCase())
  for (const m of src.matchAll(/\b\d[\d.,]*\s?[kmb]?\+?\s?(?:users|customers|clients|servers|devices|endpoints|sites|branches|transactions|requests|tickets|records|employees|engineers|people|hours|days|minutes|seconds|projects|apps|applications|nodes|vms|tps|rps|qps)\b/gi)) {
    out.add(m[0].replace(/\s+/g, ' ').toLowerCase())
  }
  for (const m of src.matchAll(/\b\d+(?:\.\d+)?x\b/gi)) out.add(m[0].toLowerCase())
  return out
}

export function contacts(text) {
  const src = String(text || '')
  return {
    emails: new Set([...src.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((m) => m[0].toLowerCase())),
    urls: new Set([...src.matchAll(/(?:https?:\/\/|www\.)[^\s|)\]]+/gi)].map((m) => m[0].toLowerCase().replace(/[.,)]+$/, ''))),
    // Phone digits only — formatting differs freely between source and output.
    phones: new Set([...src.matchAll(/(?:\+?\d[\d\s()-]{7,}\d)/g)].map((m) => m[0].replace(/\D/g, '')).filter((d) => d.length >= 8)),
  }
}

/** What fraction of the source's hard tokens survived, plus what was lost. */
export function retention(sourceText, resultText) {
  const res = norm(resultText)
  const has = (t) => res.includes(norm(t))

  const srcTech = techTokens(sourceText)
  const lostTech = [...srcTech].filter((t) => !has(t))
  const srcMetrics = metrics(sourceText)
  const lostMetrics = [...srcMetrics].filter((t) => !has(t))

  const a = contacts(sourceText)
  const b = contacts(resultText)
  const lostEmails = [...a.emails].filter((e) => !b.emails.has(e))
  // A link counts as kept if its host survives — the output stores a label plus
  // the URL, and trailing paths get tidied.
  const host = (u) => u.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  const resHosts = new Set([...b.urls].map(host))
  const lostUrls = [...a.urls].filter((u) => !resHosts.has(host(u)))
  const lostPhones = [...a.phones].filter((p) => ![...b.phones].some((q) => q.endsWith(p.slice(-8))))

  const pct = (lost, all) => (all.size ? Math.round((1 - lost.length / all.size) * 100) : 100)
  return {
    tech: { kept: pct(lostTech, srcTech), total: srcTech.size, lost: lostTech },
    metrics: { kept: pct(lostMetrics, srcMetrics), total: srcMetrics.size, lost: lostMetrics },
    contact: { lostEmails, lostUrls, lostPhones },
  }
}
