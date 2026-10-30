import { describe, it, expect } from 'vitest'
import { budgetFor, shownSizes, MAX_IMAGE_BYTES, MAX_IMAGE_SIDE, MIN_IMAGE_BYTES } from './optimiseImage'

describe('the picture budget follows the size it is shown at', () => {
  it('a full A4 page gets the whole budget; unknown size gets it too', () => {
    expect(budgetFor({ w: 794, h: 1123 }).bytes).toBe(MAX_IMAGE_BYTES)
    expect(budgetFor(null)).toEqual({ bytes: MAX_IMAGE_BYTES, side: MAX_IMAGE_SIDE })
  })
  it('half a page gets half, and a decal gets the floor and few pixels', () => {
    expect(budgetFor({ w: 794, h: 561.5 }).bytes).toBe(Math.round(MAX_IMAGE_BYTES / 2))
    expect(budgetFor({ w: 48, h: 48 })).toEqual({ bytes: MIN_IMAGE_BYTES, side: 96 })
  })
  it('bigger than a page is still capped', () => {
    expect(budgetFor({ w: 4000, h: 3000 })).toEqual({ bytes: MAX_IMAGE_BYTES, side: MAX_IMAGE_SIDE })
  })
})

describe('displayed sizes are found in every editor\'s model', () => {
  it('Word: an image node\'s width and height, in pixels', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'data:image/png;base64,AA', width: 120, height: 60 } }] }] }
    expect(shownSizes(doc).get('data:image/png;base64,AA')).toEqual({ w: 120, h: 60 })
  })
  it('Excel: a sheet picture\'s size', () => {
    const book = { sheets: [{ images: [{ id: 'i', src: 'data:image/png;base64,BB', anchor: { row: 0, col: 0 }, size: { w: 300, h: 200 } }] }] }
    expect(shownSizes(book).get('data:image/png;base64,BB')).toEqual({ w: 300, h: 200 })
  })
  it('PowerPoint: by media id, in points, through a crop, the biggest use winning, and a background at slide size', () => {
    const deck = {
      size: { w: 960, h: 540 },
      media: { m1: { mime: 'image/png', data: 'data:image/png;base64,CC' }, m2: { mime: 'image/png', data: 'data:image/png;base64,DD' } },
      slides: [
        { elements: [{ kind: 'image', media: 'm1', x: 0, y: 0, w: 30, h: 30 }, { kind: 'image', media: 'm1', x: 0, y: 0, w: 150, h: 75, crop: { l: 0.25, t: 0, r: 0.25, b: 0 } }] },
        { bg: { type: 'image', media: 'm2' }, elements: [] },
      ],
    }
    const s = shownSizes(deck)
    // 150pt wide, half of it cropped away: the whole picture is shown 300pt = 400px wide.
    expect(s.get('data:image/png;base64,CC')).toEqual({ w: 400, h: 100 })
    expect(s.get('data:image/png;base64,DD')).toEqual({ w: 1280, h: 720 })
  })
})
