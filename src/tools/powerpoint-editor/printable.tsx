// The deck as printed pages: every slide that is shown, one to a sheet, at the
// deck's own proportions. Rendered by the same SlideView the editor draws, as
// static markup, so a slide prints as it looks.
import { fixedPages, MM, type Printable } from '../../components/office/print'
import { SlideView } from './render'
import type { DeckData } from './model'

export async function printable(deck: DeckData, title: string): Promise<Printable> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  // The deck's size is in points; the sheet is the slide's own size.
  const page = { width: (deck.size.w * 25.4) / 72, height: (deck.size.h * 25.4) / 72 }
  const W = page.width * MM
  const shown = deck.slides.filter((x) => !x.hidden)
  const pages = shown.map((x) => renderToStaticMarkup(<SlideView slide={x} width={W} ctx={{ deck, number: deck.slides.indexOf(x) + 1 }} />))
  return fixedPages({ title, pages, page })
}
