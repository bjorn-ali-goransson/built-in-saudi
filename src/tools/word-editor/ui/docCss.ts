// How the document looks on the page. This styles markup ProseMirror generates,
// not React components, so it is one scoped stylesheet rather than utilities —
// there is no element to put a class on until the editor has rendered it.
//
// Scoped under [data-wd-page] so none of it can leak into the rest of the site.
export const WD_CSS = `
[data-wd-page] .ProseMirror{outline:none;white-space:pre-wrap;word-wrap:break-word;font-family:"IBM Plex Sans Arabic",Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#1b1b1b;font-variant-ligatures:none;min-height:4em;caret-color:#0b6e4f}
[data-wd-page] .ProseMirror p{margin:0 0 6pt}
[data-wd-page] .ProseMirror h1,[data-wd-page] .ProseMirror h2,[data-wd-page] .ProseMirror h3,[data-wd-page] .ProseMirror h4,[data-wd-page] .ProseMirror h5,[data-wd-page] .ProseMirror h6{color:#0b4f3a;line-height:1.25;margin:12pt 0 6pt;font-weight:700}
[data-wd-page] .ProseMirror h1{font-size:20pt}[data-wd-page] .ProseMirror h2{font-size:16pt}[data-wd-page] .ProseMirror h3{font-size:13pt}[data-wd-page] .ProseMirror h4{font-size:12pt}[data-wd-page] .ProseMirror h5,[data-wd-page] .ProseMirror h6{font-size:11pt}
[data-wd-page] .ProseMirror blockquote{border-inline-start:3px solid #0b6e4f;margin:6pt 0;padding-inline-start:1em;color:#444}
[data-wd-page] .ProseMirror pre{background:#f3f3f0;padding:.6em .8em;border-radius:4px;font-family:"JetBrains Mono",monospace;font-size:9.5pt;white-space:pre-wrap;direction:ltr;text-align:left}
[data-wd-page] .ProseMirror code{background:#f0f0ec;padding:0 .25em;border-radius:3px;font-family:"JetBrains Mono",monospace;font-size:.92em}
[data-wd-page] .ProseMirror ul,[data-wd-page] .ProseMirror ol{margin:0 0 6pt;padding-inline-start:1.8em}
[data-wd-page] .ProseMirror li>p{margin:0 0 2pt}
[data-wd-page] .ProseMirror ul[data-checklist]{list-style:none;padding-inline-start:.4em}
[data-wd-page] .ProseMirror li.wd-check>p{display:flex;gap:.5em;align-items:baseline}
[data-wd-page] .ProseMirror li.wd-done>p{color:#7a7a7a;text-decoration:line-through}
[data-wd-page] .ProseMirror .wd-checkbox{flex:none;width:1em;height:1em;margin:0;accent-color:#0b6e4f;cursor:pointer;transform:translateY(.12em)}
[data-wd-page] .ProseMirror ol[data-kind="arabic-indic"]{list-style-type:arabic-indic}
[data-wd-page] .ProseMirror ol[data-kind="arabic-abjad"]{list-style-type:arabic-indic}
[data-wd-page] .ProseMirror hr{border:0;border-top:1px solid #bbb;margin:12pt 0}
[data-wd-page] .ProseMirror .page-break{position:relative;height:0;border-top:1px dashed #9aa79f;margin:18pt 0}
[data-wd-page] .ProseMirror .page-break::after{content:"⤓";position:absolute;inset-inline-start:50%;top:-.7em;transform:translateX(-50%);background:#fff;padding:0 .6em;font-size:8pt;color:#7a8a81;letter-spacing:.04em}
[data-wd-page][data-paged] .ProseMirror .page-break{margin:0;border-top-color:transparent}
[data-wd-page] .ProseMirror .page-break.ProseMirror-selectednode{border-top-color:#0b6e4f}
[data-wd-page] .ProseMirror a{color:#0b6e4f;text-decoration:underline}
[data-wd-page] .ProseMirror sup.footnote{counter-increment:wdfn;color:#0b6e4f;cursor:help}
[data-wd-page] .ProseMirror sup.footnote::after{content:counter(wdfn)}
[data-wd-page] .ProseMirror{counter-reset:wdfn}
[data-wd-page] .ProseMirror .tableWrapper{overflow-x:auto;margin:6pt 0}
[data-wd-page] .ProseMirror table{border-collapse:collapse;table-layout:fixed;width:100%;overflow:hidden}
[data-wd-page] .ProseMirror td,[data-wd-page] .ProseMirror th{border:1px solid #9aa;padding:3pt 6pt;vertical-align:top;position:relative;box-sizing:border-box;min-width:2em}
[data-wd-page] .ProseMirror th{background:#f2f2ee;font-weight:700;text-align:start}
[data-wd-page] .ProseMirror td p,[data-wd-page] .ProseMirror th p{margin:0}
[data-wd-page] .ProseMirror .column-resize-handle{position:absolute;inset-inline-end:-2px;top:0;bottom:0;width:4px;z-index:20;background:#0b6e4f66;pointer-events:none}
[data-wd-page] .ProseMirror.resize-cursor{cursor:col-resize}
[data-wd-page] .ProseMirror .selectedCell::after{z-index:2;position:absolute;content:"";inset:0;background:#0b6e4f22;pointer-events:none}
[data-wd-page] .ProseMirror .wd-img{position:relative;display:inline-block;max-width:100%;line-height:0}
[data-wd-page] .ProseMirror .wd-img img{max-width:100%;height:auto;display:inline-block}
[data-wd-page] .ProseMirror .wd-img-selected img{outline:2px solid #0b6e4f;outline-offset:1px}
[data-wd-page] .ProseMirror .wd-img-handle{display:none;position:absolute;inset-inline-end:-6px;bottom:-6px;width:12px;height:12px;background:#0b6e4f;border:2px solid #fff;border-radius:2px;cursor:nwse-resize;touch-action:none}
[data-wd-page] .ProseMirror .wd-img-selected .wd-img-handle{display:block}
[data-wd-page] .ProseMirror .wd-empty::before{content:attr(data-placeholder);color:#9aa;pointer-events:none;position:absolute}
[data-wd-page] .ProseMirror .wd-find{background:#fff2a8}
[data-wd-page] .ProseMirror .wd-find-current{background:#f5b84a}
[data-wd-page] .ProseMirror .wd-caret{position:relative;border-inline-start:2px solid;margin-inline:-1px;pointer-events:none}
[data-wd-page] .ProseMirror .wd-caret-label{position:absolute;bottom:100%;inset-inline-start:-2px;font:600 10px/1.4 "IBM Plex Sans Arabic",sans-serif;color:#fff;padding:0 4px;border-radius:3px 3px 3px 0;white-space:nowrap;user-select:none}
[data-wd-page] .ProseMirror-gapcursor{display:none;pointer-events:none;position:absolute}
[data-wd-page] .ProseMirror-gapcursor:after{content:"";display:block;position:absolute;top:-2px;width:20px;border-top:1px solid #000;animation:wd-blink 1.1s steps(2,start) infinite}
@keyframes wd-blink{to{visibility:hidden}}
[data-wd-page] .ProseMirror-focused .ProseMirror-gapcursor{display:block}
[data-wd-page] .ProseMirror-selectednode{outline:2px solid #0b6e4f}
[data-wd-page] .ProseMirror-hideselection *::selection{background:transparent}
[data-wd-page] .ProseMirror ::selection{background:#0b6e4f33}
`
