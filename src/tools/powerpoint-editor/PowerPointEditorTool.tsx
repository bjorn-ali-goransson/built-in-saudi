// The presentation tool: a library of decks kept in this browser, and the
// editor for the one that is open.
import { useMemo } from 'react'
import { useLocale } from '../../i18n'
import { OfficeApp } from '../../components/office/OfficeApp'
import { slidesKit } from './kit'
import { slidesTemplates } from './templates'
import { SL_STR } from './strings'
import PowerPointEditor from './PowerPointEditor'

export default function PowerPointEditorTool() {
  const { locale } = useLocale()
  const loc = locale === 'ar' ? 'ar' : 'en'
  const kit = useMemo(() => slidesKit(loc), [loc])
  const templates = useMemo(() => slidesTemplates(loc), [loc])
  return <OfficeApp kit={kit} Editor={PowerPointEditor} templates={templates} blurb={<p className="text-ink-soft text-[0.95rem] max-w-[62ch]">{SL_STR[loc].blurb}</p>} />
}
