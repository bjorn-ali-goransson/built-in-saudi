import { useState } from 'react'
import { Button, Field, Input, Panel } from './index'
import type { Locale } from '../../i18n'

// The "this PDF is locked — what is the password?" panel, shared by every tool
// that reads a PDF through pdf.js.
//
// It is a component rather than a third copy because the wording is the point:
// pdf.js DECRYPTS given the password the reader already has, so a locked file
// is an ask, not a failure — and three tools drifting into three different
// answers about where the password goes is exactly the kind of thing this repo
// extracts on sight.
//
// The two `PasswordException` codes are surfaced separately on purpose.
// Repeating "this file is locked" after a wrong attempt reads as though nothing
// was tried, so a wrong password is reported AS a wrong password.

const STR = {
  en: {
    locked: 'This PDF is password-protected. Type the password and it will be opened here, on your device — the password is passed to the PDF engine in this tab and is neither stored nor sent.',
    wrong: 'That password did not open it. Check it and try again.',
    label: 'Password',
    unlock: 'Unlock',
  },
  ar: {
    locked: 'هذا الملف محمي بكلمة مرور. اكتب كلمة المرور ليُفتح هنا على جهازك — فكلمة المرور تُمرَّر إلى محرّك PDF في هذه الصفحة ولا تُحفظ ولا تُرسل.',
    wrong: 'لم تفتحه كلمة المرور هذه. تأكّد منها وأعد المحاولة.',
    label: 'كلمة المرور',
    unlock: 'افتح',
  },
}

export function PdfPassword({
  locale,
  wrong,
  busy,
  onSubmit,
  testid = 'pdf-password',
}: {
  locale: Locale
  /** The previous attempt was rejected, as opposed to none having been made. */
  wrong?: boolean
  busy?: boolean
  onSubmit: (password: string) => void
  testid?: string
}) {
  const s = STR[locale]
  const [password, setPassword] = useState('')
  return (
    <Panel className="gap-2 border-gold-500" data-testid={`${testid}-panel`}>
      <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.locked}</p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); onSubmit(password) }}
      >
        <Field label={s.label} className="flex-1 min-w-[12rem]">
          <Input
            type="password"
            value={password}
            data-testid={`${testid}-input`}
            autoComplete="off"
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button variant="primary" type="submit" disabled={busy || !password} data-testid={`${testid}-unlock`}>
          {s.unlock}
        </Button>
      </form>
      {wrong && (
        <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid={`${testid}-wrong`}>{s.wrong}</p>
      )}
    </Panel>
  )
}
