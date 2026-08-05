import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Stack, Panel, Check } from '../../components/ui'
import { LockIcon } from '../../components/icons'
import { analyze, humanTime } from './strength'

const STR = {
  en: {
    label: 'Password', placeholder: 'Type or paste a password…',
    show: 'Show what I typed',
    strength: ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'],
    crack: 'Time to crack, guessed offline',
    bits: 'Effective entropy', bitsRaw: 'Before penalties',
    weaknesses: 'What makes it guessable',
    nothingWrong: 'No common weakness spotted. Length is still what matters most.',
    hint: 'Nothing you type is sent anywhere — this page has no network code at all. Still, prefer typing a variation rather than your real password.',
    advice: 'The single biggest win is length. Four or five unrelated words beat a short password with symbols bolted on.',
    assumption: 'Assumes an attacker with the stolen database and commodity GPUs against a fast hash — the pessimistic case, because you cannot know how the site stored it.',
    findings: {
      isCommon: 'This is one of the most-used passwords in the world.',
      containsCommon: 'It contains a very common word, which every cracking wordlist tries first.',
      sequence: 'It contains a run like abcd or 4321.',
      keyboard: 'It contains a keyboard walk like qwer or asdf.',
      repeat: 'A character or short unit just repeats.',
      year: 'It contains something that looks like a year.',
      short: 'Under 8 characters — length matters more than anything else here.',
      shape: 'It follows the Capital + word + digits + symbol shape that cracking rules expand first.',
      lettersOnly: 'Letters only, and not long enough to make up for it.',
      digitsOnly: 'Digits only — the search space is tiny.',
    } as Record<string, string>,
  },
  ar: {
    label: 'كلمة المرور', placeholder: 'اكتب أو الصق كلمة مرور…',
    show: 'أظهر ما كتبته',
    strength: ['ضعيفة جدًا', 'ضعيفة', 'مقبولة', 'قوية', 'قوية جدًا'],
    crack: 'زمن الكسر، بالتخمين دون اتصال',
    bits: 'العشوائية الفعلية', bitsRaw: 'قبل الخصومات',
    weaknesses: 'ما يجعلها قابلة للتخمين',
    nothingWrong: 'لم يُرصد ضعف شائع. ويبقى الطول هو الأهم.',
    hint: 'لا يُرسل ما تكتبه إلى أي مكان — لا تحتوي هذه الصفحة على أي كود شبكة إطلاقًا. ومع ذلك، يُفضَّل كتابة صيغة مشابهة بدل كلمة مرورك الحقيقية.',
    advice: 'أكبر مكسب هو الطول. أربع أو خمس كلمات غير مترابطة تتفوّق على كلمة قصيرة أُضيفت إليها رموز.',
    assumption: 'يفترض مهاجمًا يملك قاعدة البيانات المسروقة وبطاقات رسوميات عادية ضد تجزئة سريعة — وهو الافتراض المتشائم، لأنك لا تعرف كيف خزّنها الموقع.',
    findings: {
      isCommon: 'هذه من أكثر كلمات المرور استخدامًا في العالم.',
      containsCommon: 'تحتوي على كلمة شائعة جدًا تجرّبها كل قوائم الكسر أولًا.',
      sequence: 'تحتوي على تسلسل مثل abcd أو ٤٣٢١.',
      keyboard: 'تحتوي على مسار لوحة مفاتيح مثل qwer أو asdf.',
      repeat: 'حرف أو مقطع قصير يتكرّر فقط.',
      year: 'تحتوي على ما يشبه سنة.',
      short: 'أقل من ٨ محارف — والطول هنا أهم من أي شيء آخر.',
      shape: 'تتبع نمط: حرف كبير + كلمة + أرقام + رمز، وهو أول ما توسّعه قواعد الكسر.',
      lettersOnly: 'حروف فقط، وليست طويلة بما يكفي للتعويض.',
      digitsOnly: 'أرقام فقط — فضاء البحث ضئيل.',
    } as Record<string, string>,
  },
}

const TONE = ['bg-gold-500', 'bg-gold-500', 'bg-gold-400', 'bg-green-500', 'bg-green-600']
const TEXT_TONE = ['text-gold-500', 'text-gold-500', 'text-ink', 'text-green-700', 'text-green-700']

export default function PasswordStrengthTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)

  const r = useMemo(() => analyze(pw), [pw])

  return (
    <Stack data-testid="password-strength">
      <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
        {s.label}
        <Input dir="ltr" type={show ? 'text' : 'password'} autoComplete="off" spellCheck={false}
          className="font-mono text-[1.05rem]" data-testid="pw-input"
          placeholder={s.placeholder} value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      <Check>
        <input type="checkbox" checked={show} data-testid="pw-show" onChange={(e) => setShow(e.target.checked)} /> {s.show}
      </Check>

      {pw === '' ? (
        <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>
      ) : (
        <>
          <Panel className="flex flex-col gap-3" data-testid="pw-result">
            <div className="flex items-center gap-3 flex-wrap">
              <LockIcon className={TEXT_TONE[r.score]} />
              <span className={`font-display text-[1.35rem] rtl:font-ar ${TEXT_TONE[r.score]}`} data-testid="pw-score">
                {s.strength[r.score]}
              </span>
            </div>
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-2 flex-1 rounded-sm ${i <= r.score ? TONE[r.score] : 'bg-[color-mix(in_srgb,var(--color-ink)_10%,transparent)]'}`} />
              ))}
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[0.9rem] [&_dt]:text-ink-faint [&_dd]:text-ink [&_dd]:font-semibold">
              <div className="flex gap-1.5">
                <dt className="rtl:font-ar">{s.crack}</dt>
                <dd data-testid="pw-crack">{humanTime(r.crackSeconds, locale)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="rtl:font-ar">{s.bits}</dt>
                <dd data-testid="pw-bits">{Math.round(r.entropy)} bits</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="rtl:font-ar">{s.bitsRaw}</dt>
                <dd className="!font-normal !text-ink-faint">{Math.round(r.rawEntropy)} bits</dd>
              </div>
            </dl>
            <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.assumption}</p>
          </Panel>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.weaknesses}</h2>
            {r.findings.length === 0 ? (
              <p className="text-[0.95rem] text-green-700 rtl:font-ar" data-testid="pw-clean">{s.nothingWrong}</p>
            ) : (
              <ul className="flex flex-col gap-1" data-testid="pw-findings">
                {r.findings.map((f) => (
                  <li key={f.key} className="text-[0.92rem] text-ink-soft rtl:font-ar border-s-[3px] border-gold-500 ps-3">
                    {s.findings[f.key] ?? f.key}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.advice}</p>
          <Button to={`/${locale}/apps/password-generator`} className="self-start">
            {locale === 'ar' ? 'ولّد واحدة قوية' : 'Generate a strong one'}
          </Button>
        </>
      )}
    </Stack>
  )
}
