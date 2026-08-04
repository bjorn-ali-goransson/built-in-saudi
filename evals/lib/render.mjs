// Renders a Cv to a real PDF in node using the app's own CvPdf.tsx, bundled on
// the fly with esbuild so the eval can never test a stale copy of the template.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from './env.mjs'

let renderer

export async function getRenderer() {
  if (renderer) return renderer
  const tmp = path.join(ROOT, 'evals', 'out', '.pdfbuild')
  fs.mkdirSync(tmp, { recursive: true })
  const entry = path.join(tmp, 'entry.mjs')
  const src = path.join(ROOT, 'src/tools/cv-generator/CvPdf.tsx').replace(/\\/g, '/')
  fs.writeFileSync(entry, `export { CvDocument } from ${JSON.stringify(src)}\n`)

  const esbuild = (await import('esbuild')).default
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: path.join(tmp, 'cvpdf.mjs'),
    external: ['@react-pdf/renderer', 'react', 'react/jsx-runtime'],
    jsx: 'automatic',
    define: { 'import.meta.env.BASE_URL': '"/"' },
    logLevel: 'warning',
  })

  const { CvDocument } = await import(pathToFileURL(path.join(tmp, 'cvpdf.mjs')).href)
  const { Font, renderToBuffer } = await import('@react-pdf/renderer')
  const React = (await import('react')).default

  // Same faces as the browser, from disk rather than over HTTP.
  Font.register({
    family: 'IBM Plex Sans',
    fonts: [400, 500, 600, 700].map((w) => ({ src: path.join(ROOT, 'public', 'fonts', `ibm-plex-sans-${w}.ttf`), fontWeight: w })),
  })
  Font.registerHyphenationCallback((word) => [word])

  renderer = (cv) => renderToBuffer(React.createElement(CvDocument, { cv }))
  return renderer
}
