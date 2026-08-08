// Static accessibility checks over pasted HTML.
//
// Everything here is decidable from the markup alone, which is the whole design
// constraint: a scanner that needs to FETCH a page needs a backend, and a
// scanner that needs layout needs a rendered browser. What is left is the half
// that catches most real defects — and, importantly, the half a person can run
// on a component they are in the middle of writing.
//
// The line this tool will not cross: **an automated check cannot tell whether
// alt text is MEANINGFUL.** It can see that `alt` is absent, or that it is the
// filename, or that it repeats the caption. It cannot see that "image1" is
// useless or that a photo of a chart needs its numbers in the text. Nor can it
// judge whether a keyboard user can finish a form, or whether a modal behaves.
// Those are stated in the UI rather than quietly omitted, because a green tick
// from a tool that only looked at half the problem is worse than no tick.

export type Severity = 'high' | 'medium' | 'low'

export interface Issue {
  id: string
  severity: Severity
  title: string
  detail: string
  /** The offending markup, trimmed to something readable. */
  snippet: string
}

const snip = (el: Element, max = 120) => {
  const s = el.outerHTML.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** Alt text that exists but says nothing — the commonest near-miss. */
const USELESS_ALT = /^(image|img|photo|picture|graphic|icon|logo|spacer|untitled)?[\s._-]*\d*$/i
/** Link text that carries no meaning out of context, which is how a screen reader reads it. */
const VAGUE_LINK = /^(click here|here|read more|more|learn more|link|this|details|continue|go)$/i

export function checkHtml(html: string): Issue[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: Issue[] = []
  const add = (id: string, severity: Severity, title: string, detail: string, el: Element) =>
    out.push({ id, severity, title, detail, snippet: snip(el) })

  // --- images -------------------------------------------------------------
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const alt = img.getAttribute('alt')
    if (alt === null) {
      add('img-no-alt', 'high', 'Image with no alt attribute',
        'A screen reader falls back to reading the file name, or skips it entirely. If the image is decorative the fix is alt="" — an EMPTY alt, which is not the same as a missing one and is the only way to say "ignore this".', img)
    } else if (alt.trim() && USELESS_ALT.test(alt.trim())) {
      add('img-weak-alt', 'medium', 'Alt text that says nothing',
        `alt="${alt}" is the file name or a placeholder. It passes an automated check and tells a listener nothing.`, img)
    } else if (alt.trim() && /\.(png|jpe?g|gif|webp|svg)$/i.test(alt.trim())) {
      add('img-filename-alt', 'medium', 'Alt text is a file name', `alt="${alt}"`, img)
    }
  }

  // --- headings -----------------------------------------------------------
  const heads = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'))
  const levels = heads.map((h) => Number(h.tagName[1]))
  if (heads.length && levels[0] !== 1) {
    add('heading-no-h1', 'medium', 'The first heading is not an h1',
      'Heading level is the document outline a screen-reader user navigates by. Starting at h2 leaves the page with no title in that outline.', heads[0])
  }
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      add('heading-skip', 'medium', `Heading jumps from h${levels[i - 1]} to h${levels[i]}`,
        'A skipped level reads as a missing section. Levels are structure, not size — style the size in CSS.', heads[i])
    }
  }

  // --- links --------------------------------------------------------------
  for (const a of Array.from(doc.querySelectorAll('a'))) {
    const text = (a.textContent || '').replace(/\s+/g, ' ').trim()
    const label = a.getAttribute('aria-label') || a.getAttribute('title') || ''
    if (!text && !label && !a.querySelector('img[alt]:not([alt=""])')) {
      add('link-no-text', 'high', 'Link with no text',
        'Nothing to announce. An icon-only link needs an aria-label, or a visually-hidden span.', a)
    } else if (text && VAGUE_LINK.test(text)) {
      add('link-vague', 'medium', `Link text is "${text}"`,
        'Screen readers can list every link on a page out of context. A page of "read more" is a page of identical links.', a)
    }
  }

  // --- controls -----------------------------------------------------------
  for (const el of Array.from(doc.querySelectorAll('input,select,textarea'))) {
    const type = (el.getAttribute('type') || '').toLowerCase()
    if (type === 'hidden' || type === 'submit' || type === 'button') continue
    const id = el.getAttribute('id')
    const labelled = (id && doc.querySelector(`label[for="${CSS.escape(id)}"]`))
      || el.closest('label')
      || el.getAttribute('aria-label')
      || el.getAttribute('aria-labelledby')
    if (!labelled) {
      add('input-no-label', 'high', 'Form field with no label',
        'A placeholder is not a label: it disappears on focus, and many screen readers do not announce it. Use <label for>, wrap the field in a label, or give it an aria-label.', el)
    }
  }
  for (const b of Array.from(doc.querySelectorAll('button'))) {
    const text = (b.textContent || '').trim()
    if (!text && !b.getAttribute('aria-label') && !b.getAttribute('title')) {
      add('button-no-name', 'high', 'Button with no accessible name',
        'An icon-only button announces as "button". Add an aria-label.', b)
    }
  }

  // --- document -----------------------------------------------------------
  const ids = new Map<string, number>()
  for (const el of Array.from(doc.querySelectorAll('[id]'))) {
    const id = el.getAttribute('id') || ''
    ids.set(id, (ids.get(id) ?? 0) + 1)
  }
  for (const [id, n] of ids) {
    if (n > 1) {
      const el = doc.querySelector(`[id="${CSS.escape(id)}"]`)
      if (el) {
        add('duplicate-id', 'medium', `id="${id}" is used ${n} times`,
          'label[for], aria-labelledby and aria-describedby all resolve by id, and a duplicate silently points at the wrong element.', el)
      }
    }
  }
  for (const el of Array.from(doc.querySelectorAll('[tabindex]'))) {
    if (Number(el.getAttribute('tabindex')) > 0) {
      add('positive-tabindex', 'medium', 'Positive tabindex',
        'Anything above 0 jumps ahead of the whole document in tab order, and the rest of the page then follows it. Use 0, or reorder the markup.', el)
    }
  }
  // Tables used for data need headers; tables used for layout are a separate
  // (older) problem and are not flagged here, because telling them apart from
  // markup alone is exactly the judgement this tool refuses to fake.
  for (const t of Array.from(doc.querySelectorAll('table'))) {
    if (t.querySelector('th')) continue
    if (t.querySelectorAll('tr').length < 2) continue
    add('table-no-th', 'low', 'Table with no header cells',
      'If this is a data table, a screen reader has no way to say which column a cell belongs to. If it is a layout table, that is its own problem.', t)
  }

  const order: Severity[] = ['high', 'medium', 'low']
  return out.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
}
