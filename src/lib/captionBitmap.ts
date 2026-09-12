// Drawing a caption to a bitmap, ON THE PAGE, with the page's own fonts.
//
// EXTRACTED AT THE SECOND CALLER: `video-edit` composites this bitmap into
// every frame and `image-edit` composites it into the one frame it has, and the
// two must not grow separate opinions about wrapping, outlining or direction.
// It was the video editor's private function until the image editor needed the
// same thing, which is exactly when this repo says to move it.
//
// WHY IT IS A BITMAP AT ALL, rather than text drawn wherever the picture is
// finally composed: the video exporter draws in a WORKER, and a worker draws
// with whatever fonts the worker happens to have — which on a machine with no
// Arabic face is a row of empty boxes. Rendering here means the shaping, the
// joining of the letters and the right-to-left run order are done by the
// browser's own text engine, and the bitmap the preview shows is the very one
// that is encoded. There is no second text renderer to drift.

import { captionRect, type Caption, type Rect } from './frameCompose'

/** Arabic decides the text direction, not the UI locale — somebody writing an
 *  English caption on the Arabic side of the site wants a left-to-right line. */
const isRtl = (text: string) => /[؀-ۿݐ-ݿ]/.test(text)

/**
 * Draw one caption to a bitmap THE SIZE OF ITS BOX.
 *
 * Everything about the way this text looks is decided here, once, on the page —
 * so the stage and the encoded frame are literally the same pixels.
 *
 * The box is the contract for WRAPPING: the text runs to its width and is
 * centred in its height, so the rectangle somebody dragged is where the
 * caption sits. Wrapping at "90% of the frame" instead, as this did, means the
 * writer sets the middle of something whose extent they cannot see.
 *
 * It is not a crop, though: text that needs more room than the box has spills
 * out of it rather than losing a line, and the returned rect says how far.
 */
export async function renderCaption(
  c: Caption,
  out: { width: number; height: number },
): Promise<{ bitmap: ImageBitmap; rect: Rect } | null> {
  const text = c.text.trim()
  if (!text) return null
  const box = captionRect(c, out)
  const px = Math.max(8, Math.round(c.size * out.height))
  const pad = Math.round(px * 0.3)
  const font = `600 ${px}px "IBM Plex Sans Arabic", "Hanken Grotesk", system-ui, sans-serif`

  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return null
  measure.font = font

  const maxWidth = Math.max(1, box.w - pad * 2)
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (measure.measureText(next).width > maxWidth && line) { lines.push(line); line = word }
    else line = next
  }
  if (line) lines.push(line)
  const lineHeight = Math.round(px * 1.3)

  // THE BOX WRAPS THE TEXT; IT DOES NOT CUT IT. The rectangle is where the
  // writer put the caption and how wide the lines run, and a canvas sized
  // exactly to it silently took a chunk off a caption that needed more room —
  // a word too long to break, or one line more than the height allows. So the
  // bitmap GROWS past the box when it has to, centred on it, and the rectangle
  // it is drawn into grows with it. It is one rect, returned with the bitmap
  // and used by the stage and by the worker alike, so the preview cannot crop
  // a caption the export keeps or the other way round.
  const stroke = c.band ? 0 : Math.max(2, px * 0.09)
  const widest = lines.reduce((m, l) => Math.max(m, measure.measureText(l).width), 0)
  const width = Math.max(box.w, Math.ceil(widest + pad * 2 + stroke))
  const height = Math.max(box.h, Math.ceil(lines.length * lineHeight + pad * 2 + stroke))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (c.band) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.font = font
  ctx.fillStyle = c.colour
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.direction = isRtl(text) ? 'rtl' : 'ltr'
  if (!c.band) {
    // A white caption on a white shirt is invisible; a thin dark outline is what
    // every broadcaster does instead of demanding a band.
    ctx.lineWidth = Math.max(2, px * 0.09)
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'
    ctx.lineJoin = 'round'
  }
  // Centred in the BOX, top to bottom. A block of lines pinned to the top of a
  // tall rectangle looks like a mistake rather than a choice.
  const top = (canvas.height - lines.length * lineHeight) / 2
  lines.forEach((l, i) => {
    const y = top + i * lineHeight + lineHeight / 2
    if (!c.band) ctx.strokeText(l, canvas.width / 2, y)
    ctx.fillText(l, canvas.width / 2, y)
  })
  return {
    bitmap: await createImageBitmap(canvas),
    rect: {
      x: (box.x - (width - box.w) / 2) / out.width,
      y: (box.y - (height - box.h) / 2) / out.height,
      w: width / out.width,
      h: height / out.height,
    },
  }
}

