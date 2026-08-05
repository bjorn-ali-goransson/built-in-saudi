import type { ReactNode } from 'react'

// One disclaimer component instead of a bespoke paragraph per tool.
//
// These were drifting: each calculator had grown its own wording, its own
// placement and its own emphasis, so the same class of caveat looked serious in
// one tool and like a footnote in another. A tool that estimates your severance
// pay or converts a blood-glucose reading needs to say the same thing, the same
// way, every time — and a reader who has seen one should recognise the next.
//
// The `kind` carries the standing text; `children` carries what is specific to
// the tool (which article of the law, which equation, which authority to check).

export type DisclaimerKind = 'medical' | 'financial' | 'legal' | 'religious' | 'official'

const TEXT: Record<DisclaimerKind, { en: string; ar: string }> = {
  medical: {
    en: 'This is an estimate, not medical advice. It cannot account for your health, medication or circumstances. Talk to a doctor or a pharmacist before acting on it — and never use it to change a dose or a treatment.',
    ar: 'هذا تقدير وليس استشارة طبية، ولا يمكنه مراعاة حالتك الصحية أو أدويتك أو ظروفك. راجع طبيبًا أو صيدليًا قبل التصرّف بناءً عليه — ولا تستخدمه أبدًا لتغيير جرعة أو علاج.',
  },
  financial: {
    en: 'A neutral calculation, not financial advice. Figures are indicative — the amount you are actually paid or charged depends on your contract and your provider.',
    ar: 'حساب محايد وليس استشارة مالية. الأرقام إرشادية — والمبلغ الذي تُدفع أو تُطالب به فعلًا يعتمد على عقدك وعلى الجهة المتعاملة معك.',
  },
  legal: {
    en: 'Informational only, not legal advice. Rules change and individual cases turn on details this cannot see. Check with the authority concerned, or a lawyer, before you rely on it.',
    ar: 'للاطّلاع فقط، وليست استشارة نظامية. الأنظمة تتغيّر، والحالات الفردية تتوقّف على تفاصيل لا تراها هذه الأداة. راجع الجهة المختصة أو محاميًا قبل الاعتماد عليها.',
  },
  religious: {
    en: 'A helping estimate, not a fatwa. Rulings differ between scholars and turn on circumstances — ask someone qualified about your own case.',
    ar: 'تقدير مُعين وليس فتوى. تختلف الأقوال بين أهل العلم وتتوقّف على الأحوال — فاسأل مختصًا عن حالتك.',
  },
  official: {
    en: 'Worked out from what you entered. Always confirm the real figure with the official source before you act on it.',
    ar: 'محسوب مما أدخلته. تأكّد دائمًا من الرقم الرسمي من مصدره قبل التصرّف بناءً عليه.',
  },
}

/**
 * `tone: 'strong'` for anything where acting on a wrong number causes harm —
 * medicine, entitlements, deadlines. Quieter for calculations where being out
 * by a bit costs nothing.
 */
export function Disclaimer({
  kind, locale, children, tone = 'strong', ...rest
}: {
  kind: DisclaimerKind
  locale: 'en' | 'ar'
  children?: ReactNode
  tone?: 'strong' | 'quiet'
} & React.HTMLAttributes<HTMLElement>) {
  const strong = tone === 'strong'
  return (
    <aside
      {...rest}
      // After the spread on purpose: a caller must not be able to rename the
      // testid or the kind, or the build-time guard that every risky tool
      // carries a disclaimer stops guarding anything.
      role="note"
      data-testid="disclaimer"
      data-kind={kind}
      className={
        'flex flex-col gap-1 border-s-[3px] ps-3 pe-3 py-2.5 rounded-e-md '
        + (strong
          ? 'border-gold-500 bg-[color-mix(in_srgb,var(--color-gold-400)_12%,transparent)]'
          : 'border-[color:var(--line)]')
      }
    >
      <span className={`text-[0.88rem] leading-snug rtl:font-ar ${strong ? 'text-ink' : 'text-ink-faint'}`}>
        {TEXT[kind][locale]}
      </span>
      {children && (
        <span className="text-[0.85rem] text-ink-soft leading-snug rtl:font-ar">{children}</span>
      )}
    </aside>
  )
}
