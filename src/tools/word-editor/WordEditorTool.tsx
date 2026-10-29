// The document tool: a library of documents kept in this browser, and the
// editor for the one that is open.
import { useMemo } from 'react'
import { useLocale } from '../../i18n'
import { OfficeApp } from '../../components/office/OfficeApp'
import { wordKit } from './kit'
import { wordTemplates } from './templates'
import { WD_STR } from './strings'
import WordEditor from './WordEditor'

export default function WordEditorTool() {
  const { locale } = useLocale()
  const loc = locale === 'ar' ? 'ar' : 'en'
  const kit = useMemo(() => wordKit(loc), [loc])
  const templates = useMemo(() => wordTemplates(loc), [loc])
  return <OfficeApp kit={kit} Editor={WordEditor} templates={templates} blurb={<p className="text-ink-soft text-[0.95rem] max-w-[62ch]">{WD_STR[loc].blurb}</p>} />
}
