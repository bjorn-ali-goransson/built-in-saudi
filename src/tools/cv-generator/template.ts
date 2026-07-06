import type { Cv } from './schema'

// Renders a Cv into a full, standalone A4 résumé document (the template the user
// supplied — sans-serif, no colour noise, print-optimised). The same HTML is
// used for the on-screen preview and the print-to-PDF window.

const esc = (s: string | undefined): string =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Escape, then turn **keyword** into <b>keyword</b> (the model marks emphasis). */
const rich = (s: string | undefined): string =>
  esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')

const CSS = `
  :root{
    --ink:#1b2230; --ink-soft:#28303e; --accent:#1e3a5f; --accent-2:#2f5482;
    --muted:#5c6675; --line:#d7dbe2; --faint:#e6e9ee; --paper:#ffffff;
    --backdrop:#e9ebef; --pad-x:16mm; --pad-y:13mm;
    --sans:'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{background:var(--backdrop);color:var(--ink);font-family:var(--sans);
    line-height:1.45;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;padding:0;}
  .resume{width:210mm;max-width:100%;margin:0 auto;background:var(--paper);
    padding:var(--pad-y) var(--pad-x);}
  .header{text-align:center;padding-bottom:11px;border-bottom:1.5px solid var(--accent);}
  .name{margin:0;font-size:28px;font-weight:700;letter-spacing:0.035em;text-transform:uppercase;line-height:1.08;color:var(--accent);}
  .contact{margin:9px 0 0;font-size:11.5px;color:var(--muted);}
  /* Links: black, underlined text labels (never raw URLs). */
  .contact a,.resume a{color:var(--ink);text-decoration:underline;}
  .contact .sep{color:var(--line);margin:0 8px;}
  .headline{margin:6px 0 0;font-size:12.5px;font-weight:600;line-height:1.4;color:var(--ink);}
  .headline .role{color:var(--accent);}
  .headline .sep{color:var(--line);margin:0 8px;font-weight:400;}
  .section{margin-top:16px;}
  .sec-head{display:flex;align-items:center;gap:12px;margin:0 0 6px;font-size:10.5px;font-weight:700;
    text-transform:uppercase;letter-spacing:0.15em;color:var(--accent);}
  .sec-head::after{content:"";flex:1;height:1px;background:var(--line);}
  .summary{margin:0;font-size:12.25px;line-height:1.4;color:var(--ink-soft);}
  .summary b{font-weight:700;color:var(--ink);}
  .skills{display:grid;grid-template-columns:max-content 1fr;gap:3px 16px;margin:0;font-size:12.25px;}
  .skills dt{margin:0;padding-top:1.5px;font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:var(--accent-2);white-space:nowrap;}
  .skills dd{margin:0;color:var(--ink);}
  .job{margin-top:7px;}
  .job:first-of-type{margin-top:0;}
  .job-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;}
  .job-meta{margin:0;font-size:12.5px;line-height:1.35;color:var(--ink);}
  .job-meta .role{font-weight:700;color:var(--ink);}
  .job-meta .co{color:var(--accent);font-weight:500;}
  .job-meta .loc{color:var(--muted);}
  .job-dates{font-size:11px;color:var(--muted);white-space:nowrap;text-align:right;flex-shrink:0;padding-top:0.5px;}
  .job ul{margin:5px 0 0;padding:0;list-style:none;}
  .job li{position:relative;padding-left:15px;margin-bottom:2.5px;font-size:12px;line-height:1.34;color:var(--ink-soft);}
  .job li:last-child{margin-bottom:0;}
  .job li::before{content:"";position:absolute;left:2px;top:0.5em;width:4px;height:4px;border-radius:1px;
    background:var(--accent-2);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .job li b,.proj-line b{font-weight:700;color:var(--ink);}
  .project{margin-top:5px;}
  .project:first-of-type{margin-top:0;}
  .proj-line{margin:0;font-size:12px;line-height:1.34;color:var(--ink-soft);}
  .proj-name{font-weight:700;color:var(--ink);}
  .row{display:flex;justify-content:space-between;align-items:baseline;gap:14px;margin-top:4px;}
  .row:first-of-type{margin-top:0;}
  .row .deg{font-size:12.5px;font-weight:600;color:var(--ink);}
  .row .inst{font-size:12px;color:var(--muted);}
  .row .year{font-size:11px;color:var(--muted);white-space:nowrap;}
  .langs{margin:0;font-size:12.25px;color:var(--ink);}
  @page{size:A4;margin:13mm 16mm;}
  @media print{
    html,body{background:#fff;}
    .resume{width:auto;max-width:none;margin:0;padding:0;}
    .job,.project,.row{break-inside:avoid;}
    .sec-head{break-after:avoid;}
    p,li{orphans:2;widows:2;}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  }
`

function contactLine(cv: Cv): string {
  const parts: string[] = []
  if (cv.contact.location) parts.push(esc(cv.contact.location))
  if (cv.contact.phone) parts.push(`<a href="tel:${esc(cv.contact.phone)}">${esc(cv.contact.phone)}</a>`)
  if (cv.contact.email) parts.push(`<a href="mailto:${esc(cv.contact.email)}">${esc(cv.contact.email)}</a>`)
  for (const l of cv.contact.links || []) parts.push(`<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
  return parts.join('<span class="sep">|</span>')
}

function section(title: string, body: string): string {
  if (!body.trim()) return ''
  return `<section class="section"><h2 class="sec-head">${esc(title)}</h2>${body}</section>`
}

function dates(a?: string, b?: string): string {
  if (a && b) return `${esc(a)} – ${esc(b)}`
  return esc(a || b || '')
}

/** The résumé body (sections), signal-first. */
function body(cv: Cv): string {
  const summary = cv.summary ? `<p class="summary">${rich(cv.summary)}</p>` : ''

  const skills = (cv.skills || []).length
    ? `<dl class="skills">${cv.skills.map((g) => `<dt>${esc(g.category)}</dt><dd>${esc(g.items)}</dd>`).join('')}</dl>`
    : ''

  const experience = (cv.experience || [])
    .map((j) => `<article class="job"><div class="job-head"><p class="job-meta">`
      + `<span class="role">${esc(j.role)}</span>, <span class="co">${esc(j.company)}</span>`
      + (j.location ? ` <span class="loc">(${esc(j.location)})</span>` : '')
      + `</p><span class="job-dates">${dates(j.startYear, j.endYear)}</span></div>`
      + `<ul>${(j.bullets || []).map((b) => `<li>${rich(b)}</li>`).join('')}</ul></article>`)
    .join('')

  const projects = (cv.projects || [])
    .map((p) => `<div class="project"><p class="proj-line"><span class="proj-name">${esc(p.name)}</span> — ${rich(p.description)}</p></div>`)
    .join('')

  const dated = (items: Cv['certifications']) => items
    .map((c) => `<div class="row"><span class="deg">${esc(c.title)}${c.detail ? ` <span class="inst">· ${esc(c.detail)}</span>` : ''}</span><span class="year">${esc(c.year)}</span></div>`)
    .join('')

  const education = (cv.education || [])
    .map((e) => `<div class="row"><span class="deg">${esc(e.degree)}${e.institution ? ` <span class="inst">· ${esc(e.institution)}</span>` : ''}</span><span class="year">${esc(e.year)}</span></div>`)
    .join('')

  const languages = (cv.languages || []).length
    ? `<p class="langs">${cv.languages.map((l) => esc(l.name) + (l.level ? ` (${esc(l.level)})` : '')).join(' · ')}</p>`
    : ''

  return [
    section('Summary', summary),
    section('Skills', skills),
    section('Experience', experience),
    section('Projects', projects),
    section('Talks', dated(cv.talks || [])),
    section('Certifications', dated(cv.certifications || [])),
    section('Publications', dated(cv.publications || [])),
    section('Education', education),
    section('Languages', languages),
  ].join('')
}

/** Full standalone HTML document for preview + print. */
export function renderCvHtml(cv: Cv, opts: { preview?: boolean } = {}): string {
  const header = `<header class="header">`
    + `<h1 class="name">${esc(cv.name)}</h1>`
    + `<p class="contact">${contactLine(cv)}</p>`
    + `<p class="headline"><span class="role">${esc(cv.role)}</span>`
    + (cv.available ? `<span class="sep">|</span><span>${esc(cv.available)}</span>` : '')
    + `</p></header>`
  const inner = `<main class="resume">${header}${body(cv)}</main>`
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>${esc(cv.name)} — CV</title>`
    + `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
    + `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">`
  if (opts.preview) {
    // Scale the whole A4 page down to the viewport width (never up) so the
    // preview shows the real, uniform proportions of the printed result.
    // CSS zoom (not transform) so it scales the layout box too — then margin:auto
    // centres it and there's no stray whitespace beside the page.
    // The .resume is contenteditable so edits flow straight into the exported PDF.
    const pcss = `html,body{background:#e9ebef;margin:0;padding:0}#cvfit{width:210mm;margin:0 auto}.resume{box-shadow:0 2px 12px rgba(20,30,50,.13)}[contenteditable]{outline:none}`
    const editable = inner.replace('<main class="resume">', '<main class="resume" contenteditable="true" spellcheck="false">')
    const scr = `<script>(function(){
      function f(){var p=210*96/25.4,el=document.getElementById('cvfit');if(!el)return;el.style.zoom=Math.min(1,document.documentElement.clientWidth/p)}
      window.addEventListener('resize',f);window.addEventListener('load',f);document.addEventListener('DOMContentLoaded',f);setTimeout(f,60);setTimeout(f,400);
      document.addEventListener('keydown',function(e){
        if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.metaKey)return;
        var sel=window.getSelection();if(!sel||!sel.rangeCount)return;
        var n=sel.anchorNode,li=n&&n.nodeType===1?n:(n&&n.parentElement);
        while(li&&li.tagName!=='LI'){if(li.tagName==='BODY'){li=null;break}li=li.parentElement}
        if(!li)return;
        e.preventDefault();
        var range=sel.getRangeAt(0);
        var after=range.cloneRange();after.selectNodeContents(li);after.setStart(range.endContainer,range.endOffset);
        var frag=after.extractContents();
        var newLi=document.createElement('li');
        if((''+frag.textContent).trim()){newLi.appendChild(frag)}else{newLi.appendChild(document.createElement('br'))}
        if(!(''+li.textContent).trim()){li.appendChild(document.createElement('br'))}
        li.parentNode.insertBefore(newLi,li.nextSibling);
        var r2=document.createRange();r2.setStart(newLi,0);r2.collapse(true);sel.removeAllRanges();sel.addRange(r2);
      });
    })();<\/script>`
    return `<!doctype html><html lang="en"><head>${head}<style>${CSS}${pcss}</style></head><body><div id="cvfit">${editable}</div>${scr}</body></html>`
  }
  return `<!doctype html><html lang="en"><head>${head}<style>${CSS}</style></head><body>${inner}</body></html>`
}

/** Wrap an already-rendered .resume element's HTML into a print/PDF document
 *  (A4, no preview scaling) — used to export exactly what the user edited. */
export function renderPrintDoc(resumeHtml: string, name = 'CV'): string {
  const head = `<meta charset="utf-8"><title>${esc(name)}</title>`
    + `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
    + `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">`
  return `<!doctype html><html lang="en"><head>${head}<style>${CSS}</style></head><body>${resumeHtml}</body></html>`
}
